const mainService = require('../services/main');
const wbm = require('wbm');

module.exports = class TipoEspecialidade {

    static async qrCode(req, res) {
        mainService.getQrCode(req.query.session).then((data) => {
    
            if (data === true) {
              wbm.end();
              return res.status(200).send({qrcode: true});
            }
               
            wbm.end(true);    
            return res.status(200).send({qrcode: false, data});    
        });
    }

    static async scrapper(req, res) {
        const data = await mainService.scrapper(req.body);
        return res.status(200).send(data);
    }
}