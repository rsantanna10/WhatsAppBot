const csv = require('csv-parser')
const fs = require('fs');
const wbm = require('./src/index');

(async () => {
    //Obtendo contatos
    let phones = [];
    await fs.createReadStream('contatos-scrapper.csv')
            .pipe(csv())
            .on('data', (data) => phones.push(data))
            .on('end', async () => {
                console.log(phones);
                await wbm.start({showBrowser: true}).then(async () => {
                await wbm.scrapperLastMessage(phones);
                await wbm.end();
                })
            .catch(err => console.log(err));                
    });
})();