const puppeteer = require("puppeteer");
const qrcode = require("qrcode-terminal");
const { from, merge } = require('rxjs');
const { take } = require('rxjs/operators');
const path = require('path');
var rimraf = require("rimraf");
const fs = require("fs");

let browser = null;
let page = null;
let counter = { fails: 0, success: 0 }
const tmpPath = path.resolve(__dirname, '../tmp');

const SELECTORS = {
    LOADING: "progress",
    INSIDE_CHAT: "document.getElementsByClassName('two')[0]",
    QRCODE_PAGE: "body > div > div > .landing-wrapper",
    QRCODE_DATA: ".landing-main > div:nth-child(2) > div > div:nth-child(2) > div",
    QRCODE_DATA_ATTR: "data-ref",
    SEND_BUTTON: 'div:nth-child(2) > button > span[data-icon="send"]'
};

/**
 * Initialize browser, page and setup page desktop mode
 */
async function start({ showBrowser = true, qrCodeData = false, session = true } = {}) {
    if (!session) {
        deleteSession(tmpPath);
    }

    const args = {
        headless: !showBrowser,
        userDataDir: tmpPath,
        args: ["--no-sandbox",
               "--disable-setuid-sandbox",
               '--disable-gpu'
            // "--blink-settings=imagesEnabled=false"]
        ]
    }
    try {
        browser = await puppeteer.launch(args);
        page = await browser.newPage();
        // prevent dialog blocking page and just accept it(necessary when a message is sent too fast)
        page.on("dialog", async dialog => { await dialog.accept(); });
        // fix the chrome headless mode true issues
        // https://gitmemory.com/issue/GoogleChrome/puppeteer/1766/482797370
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36");
        page.setDefaultTimeout(60000);

        await page.goto("https://web.whatsapp.com");
        if (session && await isAuthenticated()) {
            if (qrCodeData)
                return true;
            return;
        }
        else {
            if (qrCodeData) {
                console.log('Getting QRCode data...');
                console.log('Note: You should use wbm.waitQRCode() inside wbm.start() to avoid errors.');
                return await getQRCodeData();
            } else {
                await generateQRCode();
            }
        }

    } catch (err) {
        deleteSession(tmpPath);
        throw err;
    }
}

/**
 * Check if needs to scan qr code or already is is inside the chat
 */
function isAuthenticated() {
    console.log('Authenticating...');
    return merge(needsToScan(page), isInsideChat(page))
        .pipe(take(1))
        .toPromise();
}

function needsToScan() {
    return from(
        page
            .waitForSelector(SELECTORS.QRCODE_PAGE, {
                timeout: 0,
            }).then(() => false)
    );
}

function isInsideChat() {
    return from(
        page
            .waitForFunction(SELECTORS.INSIDE_CHAT,
                {
                    timeout: 0,
                }).then(() => true)
    );
}

function deleteSession() {
    rimraf.sync(tmpPath);
}
/**
 * return the data used to create the QR Code
 */
async function getQRCodeData() {
    await page.waitForFunction(`document.querySelector('${SELECTORS.QRCODE_DATA}') !== '' && document.querySelector('${SELECTORS.QRCODE_DATA}').getAttribute('data-ref') !== null`, { timeout: 120000 });
    let element = await page.$(SELECTORS.QRCODE_DATA)
    
    return await page.evaluate(el => el.getAttribute('data-ref'), element);
}

/**
 * Access whatsapp web page, get QR Code data and generate it on terminal
 */
async function generateQRCode() {
    try {
        console.log("generating QRCode...");
        const qrcodeData = await getQRCodeData();
        qrcode.generate(qrcodeData, { small: true });
        console.log("QRCode generated! Scan it using Whatsapp App.");
    } catch (err) {
        console.log(err)
        throw await QRCodeExeption("QR Code can't be generated(maybe your connection is too slow).");
    }
    await waitQRCode();
}

/**
 * Wait 30s to the qrCode be hidden on page
 */
async function waitQRCode() {
    // if user scan QR Code it will be hidden
    try {
        await page.waitForSelector(SELECTORS.QRCODE_PAGE, { timeout: 30000, hidden: true });
    } catch (err) {
        throw await QRCodeExeption("Dont't be late to scan the QR Code.");
    }
}

/**
 * Close browser and show an error message
 * @param {string} msg 
 */
async function QRCodeExeption(msg) {
    await browser.close();
    return "QRCodeException: " + msg;
}

/**
 * @param {string} phone phone number: '5535988841854'
 * @param {string} message Message to send to phone number
 * Send message to a phone number
 */
 async function VerifyInvalidNumber() {

    //Verificação de número inválido
    let invalidNumber = false;
    let messageInvalid = '';
    do {

      try {
        const divInvalid = 'div[data-animate-modal-backdrop="true"] > div > div[data-animate-modal-popup="true"] > div > div:nth-of-type(1)';
        
        await page.waitForSelector(divInvalid, { timeout: 8000 });
        messageInvalid = await page.$eval(divInvalid, el => el.textContent);
  
        if (messageInvalid === 'O número de telefone compartilhado através de url é inválido.' || messageInvalid === 'Phone number shared via url is invalid.') {
          invalidNumber = true;
          break;
        }
      } catch (error) {
          //Nova verificação
          try {
              await page.waitForSelector('div._3NCh_ > div > div', { timeout: 4000 });
              invalidNumber = true;
              break;
            } catch {
                break;
            }
      }
    } while(messageInvalid === 'Iniciando conversa' || 'Starting chat')
    return invalidNumber;
}

/**
 * @param {string} phone phone number: '5535988841854'
 * @param {string} message Message to send to phone number
 * Send message to a phone number
 */
async function sendTo(phoneOrContact, message) {
    let phone = phoneOrContact;
    if (typeof phoneOrContact === "object") {
        phone = phoneOrContact.phone;
        message = generateCustomMessage(phoneOrContact, message);
    }
    try {
        process.stdout.write("Sending Message...\r");
		await page.waitForSelector("div#startup", { hidden: true, timeout: 180000 });
        
        await page.waitForSelector('#side', { timeout: 180000 });
        try {
            await page.waitForSelector('#contact_send', { timeout: 1000 });
        } catch (err) {
            await page.evaluate(() => {
              document.querySelector('#side').innerHTML += '<a id="contact_send" target="_blank" rel="noopener noreferrer" class="_1VzZY selectable-text invisible-space copyable-text">Enviar</a>';
            });
        }

        async function setSelectVal(sel, val) {
            page.evaluate((data) => {
                return document.querySelector(data.sel).href = data.val
            }, {sel, val})
        }
        
        await setSelectVal('#contact_send', `https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
		
		const form = await page.$('a#contact_send');
		await form.evaluate( f => f.click() );

        //Aguardar 3 segundos
        await sleep(3000);

        //Verificação de número inválido
        const invalidNumber = await VerifyInvalidNumber();

        if (invalidNumber) {
            throw ('Número inválido');
        }
        
        await page.waitForSelector('div[tabindex="-1"]', { timeout: 5000 });
        await page.keyboard.press("Enter");
        
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${phone} - Enviado\n`);
		counter.success++;
        await sleep(60000 * (Math.floor(Math.random() * (3 - 1)) + 1));
        
    } catch (err) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${phone} - ${err} - Falha\n`);
        counter.fails++;
    }
}

async function send(phoneOrContacts, message) {

    const arrMessage = message.split('----');

    for (let i = 0; i < phoneOrContacts.length; i++) {
        await sendTo(phoneOrContacts[i].number, arrMessage[i%arrMessage.length].replace('{name}', phoneOrContacts[i].name));
    }
}

/**
 * @param {array} phones Array of phone numbers: ['5535988841854', ...]
 * @param {string} message Message to send to every phone number
 * Send same message to every phone number
 */

 async function scrapperLastMessageTo(phoneOrContact) {

    const formatDateTime = (dt) => {
        let dateTimeFormat = dt.substr(0, dt.indexOf(']')).replace('[', '').replace(']', '').replace(' ', '').split(','); 
        return dateTimeFormat[1] + ' ' + dateTimeFormat[0];
    }

    let phone = phoneOrContact;
    if (typeof phoneOrContact === "object") {
        phone = phoneOrContact.phone;
    }
    try {
        process.stdout.write("Scrapping ...\r");
		await page.waitForSelector("div#startup", { hidden: true, timeout: 180000 });
        
        await page.waitForSelector('#side', { timeout: 180000 });
        try {
            await page.waitForSelector('#contact_send', { timeout: 1000 });
        } catch (err) {
            await page.evaluate(() => {
              document.querySelector('#side').innerHTML += '<a id="contact_send" target="_blank" rel="noopener noreferrer" class="_1VzZY selectable-text invisible-space copyable-text">Enviar</a>';
            });
        }

        async function setSelectVal(sel, val) {
            page.evaluate((data) => {
                return document.querySelector(data.sel).href = data.val
            }, {sel, val})
        }
        
        await setSelectVal('#contact_send', `https://wa.me/${phone}`);
		
		const form = await page.$('a#contact_send');		
        await form.evaluate( f => f.click() );
        
        //Aguardar 3 segundos
        await sleep(3000);

        const invalidNumber = await VerifyInvalidNumber();

        if (invalidNumber) {
            throw ({ type: 'NUMERO_INVALIDO', message:'Número sem WhatsApp cadastro'});
        }
        
        let sent = '-';
        let dateFormat = '-';
        let statusFormat = '-';
        let typeContact = '-';

        message: {          
            try {
                await page.waitForSelector('#main .copyable-area div[role="row"]:last-of-type', { timeout: 10000 });
            } catch (err) {
                statusFormat = 'Não possui mensagem para esse contato';
                break message;
            }           

            //Verificando se possui mensagem
            const selector = '#main .copyable-area div[role="application"] > div[role="row"] > div';
            const divs = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(d => d.getAttribute("data-id")), selector, { timeout: 10000 });

            if (divs.length === 0) {
                statusFormat = 'Não possui mensagem para esse contato';
                break message;
            }

            if(divs.length === 1) {
                try{
                    await page.waitForSelector("div[data-id='" + divs[0] + "'] > > div[class*='message-']", { timeout: 2000 });
                } catch (err) {
                    statusFormat = 'Não possui mensagem para esse contato';
                    break message;
                }
            }
            
           
            const dataIdLastMessage = divs[divs.length -1];

            const date = await page.$$eval("div[data-id='" + dataIdLastMessage + "'] > div > div > div > div:first-of-type > div > div:first-of-type", el => el.map(x => x.getAttribute("data-pre-plain-text")));

            if (date[0] !== null) {
                dateFormat = formatDateTime(date[0]);
            }

            sent = dataIdLastMessage.trim().includes("true_") ? 'Enviada' : 'Recebida';

            let status = '-';

            if (sent === 'Enviada') {
                status = (await page.$$eval("div[data-id='" + dataIdLastMessage + "'] > div >  div:first-of-type > div:first-of-type > div:first-of-type >  div:last-of-type > div > div > span", el => el.map(x => x.getAttribute("aria-label"))))[0].trim();
            }

            statusFormat = (status === 'Read' || status === 'Lida') ? 'Lida' : 
                           (status === 'Delivered' || status === 'Entregue') ? 'Entregue' : 
                           (status === 'Sent' || status === 'Enviada') ? 'Enviada' : 
                           (status === 'Pending' || status === 'Pendente') ? 'Pendente' :
                           status === '-' ? status : 'Status não reconhecido';
        }

        let txtTags = '';
/*

        //Parte de Etiquetas
        const formTags = await page.$('div[data-testid="conversation-info-header"]');
        await formTags.evaluate( f => f.click() );

        let typePersonPF = null;
        //Verificando contato PJ ou PF
        try {
            await page.waitForSelector('div[data-testid="business-title"]', { timeout: 5000 });
            typePersonPF = false;
        } catch {
            typePersonPF = true;
        }

        typeContact = typePersonPF ? 'Contato comum' : 'Contato comercial';

        //Página de informações do contato
        const selectorTags = `div[data-testid="chat-info-drawer"] > div > section > div:nth-of-type(${typePersonPF ? 1 : 3}) > div:last-of-type`;
        await page.waitForSelector(selectorTags, { timeout: 10000 });

        const divsTags = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(d => d.getAttribute("class")), ` ${selectorTags} > div`, { timeout: 10000 });
        
        if(divsTags.length == 0 || divsTags == null) {
            txtTags = 'Sem etiqueta';
        } else {

            for (let i = 1; i <= divsTags.length; i++) {
                const divSelectorTag = `${selectorTags} > div:nth-of-type(${i}) > div > span`;
                try {
                    await page.waitForSelector(divSelectorTag, { timeout: 10000 });
                    let spanTag = await page.$(divSelectorTag);
                    txtTags += `${await page.evaluate(el => el.textContent, spanTag)},`;
                } catch {
                    continue;
                }      
             }
             txtTags = txtTags.replace(/,\s*$/, "");
        }        
        */

        //process.stdout.clearLine();
        //process.stdout.cursorTo(0);
        process.stdout.write(`${phone} - Scrapper OK\n`);
		counter.success++;
        return `${phone};${sent};${dateFormat};${statusFormat};${typeContact};${txtTags}\n`;
        
        
    } catch (err) {
        //process.stdout.clearLine();
        //process.stdout.cursorTo(0);
        process.stdout.write(`${phone} - ${err.message} - Scrapper Falha\n`);
        counter.fails++;
        if (err.type) {
            return `${phone};${err.type};;${err.message}\n`;
        } else {
            return `${phone};Erro;;${err}\n`;
        }        
    }
}

async function scrapperLastMessage(phoneOrContacts) {

    var writeStream = fs.createWriteStream("enviados-recebidos.csv");

    const header = 'Número;Status;Data da Ocorrência;Descrição;Tipo Contato;Etiquetas\n';
    writeStream.write(header);
       
    let arrResult = [];

    arrResult.push(header)

    console.log(phoneOrContacts)
    for (let phoneOrContact of phoneOrContacts) {
        const result = await scrapperLastMessageTo(phoneOrContact.number);
        writeStream.write(result);
        arrResult.push(result)
    }

    writeStream.end();
    return arrResult;
}

/**
 * @param {object} contact contact with several properties defined by the user
 * @param {string} messagePrototype Custom message to send to every phone number
 * @returns {string} message
 * Replace all text between {{}} to respective contact property
 */
function generateCustomMessage(contact, messagePrototype) {
    let message = messagePrototype;
    for (let property in contact) {
        message = message.replace(new RegExp(`{{${property}}}`, "g"), contact[property]);
    }
    return message;
}

/**
 * Close browser and show results(number of messages sent and failed)
 */
async function end(waitStart = false) {

    if (browser == null) return;
    if (!waitStart) {
        await browser.close();
        console.log(`Result: ${counter.success} sent, ${counter.fails} failed`);
    } else {
        try {
            await page.waitForSelector("div#startup", { hidden: true, timeout: 60000 });
            await page.waitForSelector('#side', { timeout: 180000 });
            await browser.close();
        } catch { }        
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports = {
    start,
    send,
    sendTo,
    scrapperLastMessage,
    scrapperLastMessageTo,
    end,
    waitQRCode
}