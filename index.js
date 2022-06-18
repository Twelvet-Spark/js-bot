// Author: Twelvet-Spark
// GitHub: https://github.com/Twelvet-Spark
// Description: Telegram bot about personal data protection.
// Now with GIT!

import TelegramBot from "node-telegram-bot-api";
import config from "config";
import { Ngrok } from "@ngrok/ngrok-api";
import readline from 'readline';
import mysql from "mysql";

/**
 * Get chapters and episodes
 * @return {dictionary} Dictionary with key word "chapter name" that contains array of chapters
 
async function getChaptersEpisodes() {
  const chapters = config.get('chapters');
  const allChaptersEpisodes = [config.get('chapterOneEpisodes'), config.get('chapterTwoEpisodes'), config.get('chapterThreeEpisodes'),
  config.get('chapterFourEpisodes'), config.get('chapterInfo')];

  let completeCh_Ep = {};

  for (let i = 0; i < chapters.length; i++) {
    completeCh_Ep[chapters[i]] = allChaptersEpisodes[i] // Dictionary with key word "chapter name" that contains array of chapters
  };
  console.log("------------------------ FUNCTION CHAPTERS AND EPISODES");
  console.log(completeCh_Ep);
  return completeCh_Ep;
}; */

// Creating db object
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: config.get('DBpassword'),
  database: 'usersdb'
});

// Connecting to db
db.connect((err) => {
  if(err) throw err;
  console.log('MySql connected...')
});

// Setting up input
let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Async function used to get user input
async function input(prompt) {
  console.log(prompt);
  let result = (await rl[Symbol.asyncIterator]().next()).value;
  if (result == undefined) {
    console.log('We got undefined input. Changing input to \'n\'.')
    result = 'n'
  };
  return result;
}

// Creating bot object
const TOKEN = config.get('token')
const bot = new TelegramBot(TOKEN, {
    webHook: {
        port: config.get('port')
    }
});

// Setting up Ngrok
const ngrok = new Ngrok({
  apiToken: config.get('ngrok_API_key'),
});
// Search for Ngrok url
// If url not found, await user input and retry or close
// You need to run Ngrok client on your machine to get url
let ngrokUrl = ''
let settingsReady = false;
let listEndpoints
while (settingsReady != true) {
  listEndpoints = await ngrok.endpoints.list()
  if (listEndpoints.length == 0) { // If there is no Ngrok enpoints
    console.log("\nNgrok endpoints not found...\nCheck your Ngrok client or settings")
    // let cycle = 0 // DEBUG PURPOSE: counter
    while (true) {
      // console.log(cycle++) // DEBUG PURPOSE: counter log
      let answer = await input('Retry? (Y/N): ')
      if (answer == 'Y' || answer == 'y') {
        console.log('\n\nRetrying...')
        break
      }
      else if (answer == 'N' || answer == 'n') {
        console.log('\n\nClosing program...')
        process.exit(1)
      }
    }
  }
  else { // If we found Ngrok endpoints, then get "https" full address
    console.log(listEndpoints) // DEBUG PURPOSE: endpoints list log
    for (let step = 0; step <= (listEndpoints.length-1); step++) {
      // DEBUG PURPOSE: Cycle learning
      // console.log('DEBUG ' + (listEndpoints.length-1))
      // console.log('DEBUG ' + step)
      // console.log(listEndpoints[step])
      if (listEndpoints[step].proto == 'https') {
        ngrokUrl = listEndpoints[step].publicUrl
        console.log(`New URL: ${ngrokUrl}`) // DEBUG PURPOSE: Ngrok url log
        break
      }
    }
    settingsReady = true
  }
};
// Setting up webHook for Telegram using full "https" address
bot.setWebHook(`${ngrokUrl}/bot${config.get('token')}`);

// NGROK CONNECTION CHECKER
let waitTime = 300000; // 10 seconds will eventially dead because of limit ngrok
let numberOfTries = 5;
let counter = 1;
async function checkConnection() {
  listEndpoints = await ngrok.endpoints.list()
  if (listEndpoints.length == 0) {
    console.log(`CONNECTION TO NGROK ENDPOINT LOST... (waited for ${(waitTime*counter) / 1000} seconds)`)
    if ((waitTime*counter) >= (waitTime*numberOfTries)) {
      console.log('\n\nReconnection failed, stopping program...')
      process.exit(1)
    }
    else {
      setTimeout(checkConnection, (waitTime*counter))
      counter++
    }
  }
  else if (listEndpoints.length != 0 && counter != 1) {
    for (let step = 0; step <= (listEndpoints.length-1); step++) {
      if (listEndpoints[step].proto == 'https') {
        ngrokUrl = listEndpoints[step].publicUrl
        console.log(`New URL: ${ngrokUrl}`) // DEBUG PURPOSE: Ngrok url log
        break
      }
    }
    bot.setWebHook(`${ngrokUrl}/bot${config.get('token')}`);
    console.log(`Connection restored! (after ${counter} tries)\n\n`)
    counter = 1
    setTimeout(checkConnection, (waitTime))
  }
  else {
    setTimeout(checkConnection, (waitTime))
  }
};
setTimeout(checkConnection, waitTime);

/**
 * @param {string} databaseName Get the database name from the config object 
 * @param {string} tableName Get the table name from config object 
 * @param {dictionary} data Dictionary that contains data to INSERT
 */
async function insertRecord(databaseName, tableName, data) {
  const sqlInsertRecord = `INSERT INTO ${databaseName}.${tableName} SET ?`
  
  db.query(sqlInsertRecord, data, (err2, result2) => {
    if(err2) throw err2
    //console.log(result2) // DEBUG PURPOSE:
    console.log(`USER ${data.firstname} ADDED TO ${databaseName} DATABASE, ${tableName} TABLE AND ${result2.insertId} ID`)
    //bot.sendMessage(id, "Вы были добавлены в базу данных")
  })
}

/**
 * @param {string} databaseName Get the database name from the config object
 * @param {string} tableName Get the table name from the config object
 * @param {string} lastcommand Data to set in database
 * @param {string} chatid Chat id
 */
async function updateRecord(databaseName, tableName, lastcommand, chatid) {
  const sqlUpdateCommand = `
  UPDATE ${databaseName}.${tableName}
  SET lastcommand=\"${lastcommand}\"
  WHERE chatid=${chatid};`

  db.query(sqlUpdateCommand, (err, result) => {
    if(err) throw err
    console.log("\n------------------\nDB record updated")
    console.log(result)
    console.log("\n\n")
  })
}

// ------MESSAGES
// Logic for any message get
bot.on('message', msg => {
  const { text, chat: { id, username, first_name, last_name }} = msg
  const chapters = config.get('chapters');
  const allChaptersEpisodes = [config.get('chapterOneEpisodes'), config.get('chapterTwoEpisodes'), config.get('chapterThreeEpisodes'), config.get('chapterFourEpisodes'), config.get('chapterInfo')];
  
  console.log("\n------------------\nBOT.ON(\'message\')")
  console.log("index of text " + (config.get("commands").indexOf(text) == -1) + ", !msg.entities = " + !msg.entities)
  console.log((config.get("commands").indexOf(text) == -1) && !msg.entities)
  console.log(msg)

  // If message don't have command and special phrases (commands without slash in "commands" array), 
  // then we check last command by this user, using chatid to send query to mysql database
  if(!msg.entities) {
    // ================ Setting up all arrays and dictionary of chapters and episodes. START
    let chaptersOnlyOneDim = [] // One dimentional chapter only array. initiate
    let chaptersOnlyTwoDim = config.get('chapters') // Loading two dimentional chapter only, array
    for (let step = 0; step < config.get('chapters').length; step++) {
      chaptersOnlyOneDim[step] = config.get('chapters')[step][0]
    }
    console.log(chaptersOnlyOneDim)

    let completeCh_Ep = {}; // Dictionary with key word "chapter name" that contains array of chapters
    for (let i = 0; i < chapters.length; i++) {
      completeCh_Ep[chapters[i]] = allChaptersEpisodes[i]
    };
    // ================ END

    console.log("\n--------CHECKING USER MESSAGE FOR \'message\'---------\n")
    const sqlCheckCommand = `
    SELECT ${config.get('DBtableName')}.chatid AS chatid, ${config.get('DBtableName')}.lastcommand AS lastcommand
    FROM ${config.get('DBname')}.${config.get('DBtableName')}
    WHERE chatid=${id}
    ;`
    db.query(sqlCheckCommand, (err, result) => {
      if(err) throw err

      console.log("------------------\nQUERY RESULT")
      console.log(result)
      console.log("\n\n")

      // ---------------------------------------- CHAPTER CHOOSE
      /*
      * If lastcommand is "/start"
      * and current command that has been writen is "Конечно"
      */
      if (result[0].lastcommand == (config.get('commands')[1])) {
        bot.sendMessage(id, `Супер!
        Давай начинать наше с тобой приключение в дебри личных данных и потаённых проходов в замке конфиденциальности~`, {
          reply_markup: {
            keyboard: chaptersOnlyTwoDim
          }
        })

        // Update lastcommand
        updateRecord(config.get('DBname'), config.get('DBtableName'), text, id)
      }
      // ---------------------------------------- EPISODE CHOOSE
      /*
      * If lastcommand is "Конечно"
      * and current command that has been writen is "chaptername"
      */
      else if (result[0].lastcommand == (config.get('commands')[2]) && chaptersOnlyOneDim.indexOf(text) != -1) {
        bot.sendMessage(id, `${text}\nВыберите часть`, {
          reply_markup: {
            keyboard: completeCh_Ep[text]
          }
        })

        // Update lastcommand
        updateRecord(config.get('DBname'), config.get('DBtableName'), text, id)
      }
      /**
      * If lastcommand is "chaptername"
      * and current command that has been writen is "episodename" (back to chapters)
      */
      else if (chaptersOnlyOneDim.indexOf(result[0].lastcommand) != -1 && text == "К выбору глав") {
        bot.sendMessage(id, `Список глав`, {
          reply_markup: {
            keyboard: chaptersOnlyTwoDim
          }
        })

        // Update lastcommand 
        updateRecord(config.get('DBname'), config.get('DBtableName'), "Конечно", id)
      }
      /**
      * If lastcommand is "chaptername"
      * and current command that has been writen is "episodename"
      */
      else if (text == config.get('chapterOneEpisodes')[0][0]) {
        bot.sendMessage(id, `${config.get('chapterOneEpisodes')[0]}. В этой главе мы познакомимся с самыми основами понятия \"Информации\" и \"Данных\"\n
        Для начала стоит разобраться в различии этих двух терминов. 
        Данные это некоторые сведения о чём-либо, которые ещё не были обработаны, отсортированы, анализированы.
        Инфорация в свою очередь представляет собой собранные и упорадоченные данные.`)

        // Update lastcommand
        // updateRecord(config.get('DBname'), config.get('DBtableName'), text, id)
      }
      console.log("DEBUG MODE ")
      console.log(text)
      console.log(completeCh_Ep[text])
      // ADDITIONAL REACTIONS. CODE GO HERE
    })
  }
});

// Show info about user from Update
bot.onText(/\/myinfo/, msg => {
  const {chat: { id, first_name, username}} = msg
  const {date} = msg 
  let messageText = `Вся ваша информация, что мне известна:\n Имя: ${first_name},\n ID: ${id},\n Никнейм: ${username},\n Дата вашего сообщения (Ой, снова не та дата):\n     ${new Date(date)},\n К сожалению я больше ничего не знаю о вас ;c`
  bot.sendMessage(id, messageText)
});

// ============================================ TURN OFF
// Debug function. Delete record that has user chatid in data base
bot.onText(/\/del/, msg => {
  const { chat: { id }} = msg
  let sql = `DELETE FROM ${config.get('DBname')}.${config.get('DBtableName')} WHERE ${config.get('DBtableName')}.chatid=${id};`
  db.query(sql, (err, result) => {
    if(err) throw err
    console.log(result) // DEBUG PURPOSE:
    if (result.affectedRows == 1) 
      bot.sendMessage(id, `Вы были удалены из базы данных \"${config.get('DBname')}\", таблицы \"${config.get('DBtableName')}\"`)
    else if (result.affectedRows == 0)
      bot.sendMessage(id, `Вас нет в базе данных \"${config.get('DBname')}\", таблицы \"${config.get('DBtableName')}\"`)
    else 
    bot.sendMessage(id, `Что-то нет так DEL FUNCTION \"${config.get('DBname')}\", таблицы \"${config.get('DBtableName')}\"`)
  })
})

// ============================================ TURN OFF
// Debug function. Shows all records in the database
bot.onText(/\/db/, msg => {
  const { chat: { id }} = msg
  let sql = `SELECT * FROM ${config.get('DBname')}.${config.get('DBtableName')} WHERE ${config.get('DBtableName')}.id BETWEEN 0 AND 10000`
  db.query(sql, (err, result) => {
    if(err) throw err
    console.log(result) // DEBUG PURPOSE:
    let answer = "\n\n"
    for (let record in result) {
      answer += result[record].firstname + " " + result[record].lastname + " " + result[record].chatid + " " + result[record].lastcommand + " " + result[record].insertdate
      answer += "\n\n"
    }
    bot.sendMessage(id, `База данных \"${config.get('DBname')}\", таблица \"${config.get('DBtableName')}\"
    ${answer}`)
  })
})

bot.onText(/\/start/, msg=> {
  const { chat: { id, username, first_name, last_name }} = msg

  const post = {username: username, firstname: first_name, lastname: last_name, chatid: id, 
    phonenumber: "unknown", lastcommand: "/start", location: "unknown", stage: "intro",
     intro: config.get('status').running, chapterone: config.get('status').unreached, chaptertwo: config.get('status').unreached}

  const sqlCheckUser = `
  SELECT ${config.get('DBtableName')}.chatid AS chatid
  FROM ${config.get('DBname')}.${config.get('DBtableName')}
  WHERE chatid=?
  ;`
  db.query(sqlCheckUser, post.chatid, (err, result) => {
    if(err) throw err
    //console.log(result) // DEBUG PURPOSE:
    //console.log(result.length) // DEBUG PURPOSE:
    if (result.length != 0) {
      console.log(`Yeah, i have ${result.length} records`)
      //bot.sendMessage(id, `Вы уже находитесь в базе данных, дата вашего добавления: \n${Date(result[0].insertdate)}`)
    }
    else if (result.length == 0) {
      console.log("Nope, i don't have any records")

      post.insertdate = Date.now()

      insertRecord(config.get('DBname'), config.get('DBtableName'), post)
    }
  })
  bot.sendMessage(id, `Здраствуй ${first_name}, рад тебя видеть.
  \nМеня звать Т.В.А.И.Н (Твой Верный Автономный Искусственный Напарник), можно просто Твай с;
  \nМоя основная задача - помочь тебе как можно лучше научиться обращяться со своей личной информацией и я намерен выложиться на все 100 процентов!
  \nВсе знания, что я дам тебе в ходе нашей беседы были бережно собраны в удобную и понятную форму.
  \nЯ также помогал своему создателю анализировать и обрабатывать все данные, что бы он без меня делал >.^
  \nЧто же приступим к нашей ламповой беседе?)`,
  {
    reply_markup: {
      keyboard: [
        [{
          "text": config.get('commands')[2] // Конечно
        }],
        [{
          "text": config.get('commands')[3] // У меня есть вопросы
        }]
      ]
    }
  })
})

// Check user location
/*
bot.onText(/Проверить посещяемость/, msg => {
  const { text, chat: { id, username, first_name, last_name }} = msg

  bot.sendMessage(id, "Введите фамилию и имя учащегося\nПример: Каир Арслан")
  const sqlUpdateCommand = `
  UPDATE ${config.get('DBname')}.${config.get('DBtableName')}
  SET lastcommand=?
  WHERE chatid=${id};`
  db.query(sqlUpdateCommand, text, (err, result) => {
    if(err) throw err
    console.log("\n------------------\nBOT.ON_TEXT \"Проверить посещяемось\"")
    console.log(result)
    console.log("\n\n")
  })
})
*/

// Query User number
bot.onText(/\/givenumber/, msg => {
  const { chat: { id, first_name, username }} = msg  
  bot.sendMessage(id, 'Share: ', {
    reply_markup: {
      one_time_keyboard: true,
      keyboard: [[{
        text: "Give my phone number",
        request_contact: true,
        request_location: true
      }], ["Cancel"]]
    }
  })
});