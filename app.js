var express = require('express');
var jade = require('jade');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyDecoder());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.staticProvider(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res){
  res.render('index', { locals: {
      title: 'Express Now jQuery chat'
    }
  });
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(8080);
  console.log("Express server listening on port %d", app.address().port);
}

var everyone = require("now").initialize(app);

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

