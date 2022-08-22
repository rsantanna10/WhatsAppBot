const main = require('../controllers/main');

module.exports = class Route {
    constructor(server){
        server = this.main(server);
        return server;
    }

    main(server) {
       
        server.route('/qrCode').get(main.qrCode);
        server.route('/scrapper').post(main.scrapper);
        server.route('/test').get(main.test);
        
        
	   return server;
    }
}
