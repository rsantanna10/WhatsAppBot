const main = require('../controllers/main');

module.exports = class Route {
    constructor(server){
        server = this.main(server);
        return server;
    }

    main(server){
       //Tipo especialidade
        server.route('/qrCode').get(main.qrCode);
        server.route('/scrapper').post(main.scrapper);
        
        
	   return server;
    }
}
