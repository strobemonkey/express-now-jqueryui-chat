var express = require('express@2.0.0');
var jade = require('jade@0.9.1');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res){
  res.render('index', {
      title: 'Express Now jQuery chat'
  });
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(8080);
  console.log("Express server listening on port %d", app.address().port);
}

var everyone = require("now@0.2.4").initialize(app);

everyone.connected(function(){
  console.log("Joined: " + this.now.name);
  everyone.now.receiveMessage(this.now.name, "Joins");
});

everyone.disconnected(function(){
  console.log("Left: " + this.now.name);
  everyone.now.receiveMessage(this.now.name, "Left");
});

everyone.now.distributeMessage =function(message){
  everyone.now.receiveMessage(this.now.name, message);
};

