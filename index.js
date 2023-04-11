const express = require("express");
const fileUpload = require("express-fileupload");
const app = express();
const { Configuration, OpenAIApi } = require("openai");
const fs = require("fs");
const { promisify } = require("util");
const path = require("path");
const tts = promisify(require("./utils/tts"));

require("dotenv").config({
  path: path.resolve(__dirname, ".env.preview.local"),
});

const generateAudio = (text) => {
  return new Promise((resolve, reject) => {
    const auth = {
      app_id: process.env.TTS_APP_ID,
      app_skey: process.env.TTS_API_SECRET,
      app_akey: process.env.TTS_API_KEY,
    };
    // 讯飞 api 参数配置
    const business = {
      aue: "lame",
      sfl: 1,
      speed: 50,
      pitch: 50,
      volume: 100,
      bgs: 0,
    };
    const id = new Date().getTime();
    // 存储文件的路径
    const file = path.resolve(__dirname, `client/audio/${id}.m4a`);
    try {
      // 执行请求
      tts(auth, business, text, file).then((res) => {
        resolve(`audio/${id}.m4a`);
      });
    } catch (e) {
      reject(e);
    }
  });
};

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const handleIssueReply = async (prompt) => {
  const {
    data: { choices },
  } = await openai.createCompletion({
    model: "text-davinci-003",
    prompt,
    temperature: 0.5,
    max_tokens: 1000,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
  });
  const chat = choices[0].text?.trim();
  console.log("生成的文本内容是>>>", chat);
  return chat;
};

const getAudioLength = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.stat(path.resolve(__dirname, `client/${filePath}`), function (err, stats) {
      if (err) {
        reject(err);
      }
      resolve(parseInt(stats.size / 6600));
   });
  })
}

app.use(fileUpload());

app.post("/api/audio", async (req, res) => {
  if (!req.files) return res.status(400).send({ message: "缺少参数", error: true });

  const file = req.files.file;
  // 存放用户上传的文件
  const fileName = "audio.m4a";

  file.mv(fileName, async (err) => {
    if (err) {
      return res.status(500).send(err);
    }

    const {
      data: { text: prompt },
    } = await openai.createTranscription(
      fs.createReadStream(fileName),
      "whisper-1"
    );

    console.log("解析的音频内容是>>>", prompt);
    // 判断用户上传音频是否存在内容
    if (!prompt.trim().length)
      return res.send({ message: "未识别到语音内容", error: true });

    const chatReply = await handleIssueReply(prompt);
    console.log("生成的文本内容是>>>", chatReply);

    const content = await generateAudio(chatReply);
    console.log("生成的音频是>>>", content);

    const length = await getAudioLength(content)
    console.log("生成的音频长度是>>>", length);
    
    res.send([
      { type: "system", content, chatReply, infoType: "audio", length, playStatus: false },
    ]);
  });
});

app.get("/api/submit-issue", async (req, res) => {
  const { issue } = req.query;
  if (!issue.trim()) return res.status(400).send({ message: "缺少参数", error: true });
  const chatReply = await handleIssueReply(issue);
  return res.send([{ type: "system", content: chatReply.trim() }]);
});
app.use(express.static(path.join(__dirname, "client")));

app.listen(3000);

module.exports = app;
