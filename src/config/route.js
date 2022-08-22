const main = require('../controllers/main');

module.exports = class Route {
    constructor(server){
        server = this.main(server);
        return server;
    }

    main(server) {
       
        server.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });

        
        server.route('/qrCode').get(main.qrCode);
        server.route('/scrapper').post(main.scrapper);
        
        
	   return server;
    }
}
