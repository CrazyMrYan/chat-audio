const express = require("express");
const fileUpload = require("express-fileupload");
const app = express();
const { Configuration, OpenAIApi } = require("openai");
const fs = require("fs");
const { promisify } = require("util");
const path = require("path");
const tts = promisify(require("./utils/tts"));
require("dotenv").config({ path: path.resolve(__dirname, ".env.preview.local")});

const openGreetings = (text) => {
  return new Promise((resolve, reject) => {
    const auth = {
      app_id: process.env.TTS_APP_ID, 
      app_skey: process.env.TTS_API_SECRET, 
      app_akey: process.env.TTS_API_KEY
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
    const id = new Date().getTime()
    // 存储文件的路径
    const file = path.resolve(__dirname, `client/audio/${id}.m4a`);
    try {
      // 执行请求
      tts(auth, business, text, file).then((res) => {
        resolve(`audio/${id}.m4a`)
      });
    } catch (e) {
      reject(e)
    }
  })
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
  return chat
}

app.use(fileUpload());

app.post("api/audio", async (req, res) => {
  if (!req.files) {
    return res.status(400).send("No files were uploaded.");
  }

  if(req.files) {
    const file = req.files.file;
    const fileName = "test.m4a";
  
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
      if(!prompt.trim().length) return res.send({ message: "未识别到语音内容", error: true })
      
      const text = await handleIssueReply(prompt);
      const content = await openGreetings(text);
      console.log('生成的音频是>>>', content);
      res.send([
        { type: "system", content, text, infoType: 'audio', playStatus: false },
      ]);
    });
  }

});

app.get('/api/submit-issue', async (req, res) => {
  const { issue } = req.query;
  if(!issue.trim()) return res.send({ message: "缺少参数", error: true })
  if(issue) {
    try {
      const chat = await handleIssueReply(issue);
      return res.send([
        { type: "system", content: chat },
      ]);
    } catch (error) {
      console.log(process.env.OPENAI_API_KEY);
      console.log(error);
    }
  }
})
app.use(express.static(path.join(__dirname, "client")));

module.exports = app;