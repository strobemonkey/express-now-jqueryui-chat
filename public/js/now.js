if('window' in this) {
  window.nowUtil = {};
} else {
  nowUtil = exports;
}


/* ===== BEGIN NOW UTILS ===== */

nowUtil.serializeFunction = function(fqn, func) {
  return {type: "function", fqn: fqn};
}

nowUtil.addChildrenToBlacklist = function(blacklist, parentObj, parentFqn){
  for(var prop in parentObj){
    blacklist[(parentFqn+"."+prop)] = true;
    if(typeof parentObj[prop] == 'object'){
      nowUtil.addChildrenToBlacklist(blacklist, parentObj[prop], parentFqn+"."+prop);
    }
  }
}

nowUtil.removeChildrenFromBlacklist = function(blacklist, parentObj, parentFqn){
  for(var prop in parentObj){
    delete blacklist[(parentFqn+"."+prop)];
    if(typeof parentObj[prop] == 'object'){
      nowUtil.removeChildrenFromBlacklist(blacklist, parentObj[prop], parentFqn+"."+prop);
    }
  }
}

nowUtil.getAllChildFqns = function(parentObj, parentFqn){
  var fqns = [];
  
  function getAllChildFqnsHelper(parentObj, parentFqn){
    for(var prop in parentObj){
      fqns.push(parentFqn+"."+prop);
      if(typeof parentObj[prop] == 'object'){
        getAllChildFqnsHelper(parentObj[prop], parentFqn+"."+prop);
      }
    }
  }
  getAllChildFqnsHelper(parentObj, parentFqn);
  return fqns; 
}

nowUtil.watch =  function (obj, prop, fqn, handler) {
  var val = obj[prop];
  var getter = function () {
    return val;
  }
  var setter = function (newVal) {
    var oldval = val;
    val = newVal;
    handler.call(obj, prop, fqn, oldval, newVal);
    return newVal;
  }
  if (Object.defineProperty) {// ECMAScript 5
    Object.defineProperty(obj, prop, {
      get: getter,
      set: setter
    });
  } else if (Object.prototype.__defineGetter__ && Object.prototype.__defineSetter__) { // legacy
    Object.prototype.__defineGetter__.call(obj, prop, getter);
    Object.prototype.__defineSetter__.call(obj, prop, setter);
  }
}

nowUtil.initializeScope = function(obj, socket) {
  var data = nowUtil.decycle(obj, 'now', [nowUtil.serializeFunction]);
  var scope = data[0];
  nowUtil.debug("initializeScope", JSON.stringify(data));
  //nowUtil.print(scope);
  socket.send({type: 'createScope', data: {scope: scope}});
}

nowUtil.isArray = function (obj) {
  return Array.isArray(obj);
}

nowUtil.getVarFromFqn = function(fqn, scope){
  var path = fqn.split(".");
  path.shift();
  var currVar = scope;
  while(path.length > 0){
    var prop = path.shift();
    if(currVar.hasOwnProperty(prop)) {
      currVar = currVar[prop];
    } else {
      return false;
    }
  }
  return currVar;
}

nowUtil.getVarParentFromFqn = function(fqn, scope){
  var path = fqn.split(".");
  path.shift();
  
  var currVar = scope;
  while(path.length > 1){
    var prop = path.shift();
    currVar = currVar[prop];
  }
  return currVar;
}

nowUtil.forceGetParentVarAtFqn = function(fqn, scope){
  var path = fqn.split(".");
  path.shift();
  
  var currVar = scope;
  while(path.length > 1){
    var prop = path.shift();
    if(!currVar.hasOwnProperty(prop)){
      if(!isNaN(path[0])) {
        currVar[prop] = [];
      } else {
        currVar[prop] = {};
      }
    }
    currVar = currVar[prop];
  }
  return currVar;
}

nowUtil.multiForceGetParentVarAtFqn = function(fqn, scopes){
  var path = fqn.split(".");
  path.shift();
  
  var currVar = scopes.slice(0);
  
  while(path.length > 1){
    var prop = path.shift();
    for(var i in scopes) {
      if(!currVar[i].hasOwnProperty(prop)){
        if(!isNaN(path[0])) {
          currVar[i][prop] = [];
        } else {
          currVar[i][prop] = {};
        }
      }
      currVar[i] = currVar[i][prop];
    }
  }
  return currVar;
}

nowUtil.createVarAtFqn = function(fqn, scope, value){
  var path = fqn.split(".");  

  var currVar = nowUtil.forceGetParentVarAtFqn(fqn, scope);
  currVar[path.pop()] = value;
}

nowUtil.multiCreateVarAtFqn = function(fqn, scopes, value){
  var path = fqn.split(".");
  var key = path.pop();
  var currVar = nowUtil.multiForceGetParentVarAtFqn(fqn, scopes);
  
  
  if (typeof value == "object"){
    if(nowUtil.isArray(value)) {
      for(var i in scopes) {
        currVar[i][key] = [];
      }
    } else {
      for(var i in scopes) {
        currVar[i][key] = {};
      }
    }
    nowUtil.multiMergeScopes(currVar, key, value);
  } else {
    for(var i in scopes) {
      currVar[i][key] = value;
    }    
  }
  
  
  
  
}


nowUtil.createAndBlacklistVarAtFqn = function(fqn, scope, value, blacklist, blacklistFqn){
  var path = fqn.split(".");
  path.shift();
  
  var currVar = scope;
  while(path.length > 1){
    var prop = path.shift();
    blacklistFqn += "."+prop;
    if(!currVar.hasOwnProperty(prop)){
      if(!isNaN(path[0])) {
        blacklist[blacklistFqn] = true;
        currVar[prop] = [];
      } else {
        blacklist[blacklistFqn] = true;
        currVar[prop] = {};
      }
    }
    currVar = currVar[prop];
  }
  var finalProp = path.pop();
  blacklist[fqn] = true;
  currVar[finalProp] = value;
}

nowUtil.deepCreateVarAtFqn= function(fqn, scope, value){
  var path = fqn.split(".");
  path.shift();
  
  var currVar = nowUtil.getVarParentFromFqn(fqn, scope);
  if (typeof value == "object"){
    var prop = path.pop();
    if(nowUtil.isArray(value)) {
      currVar[prop] = [];
    } else {
      currVar[prop] = {};
    }
    nowUtil.mergeScopes(currVar[prop], value);
  } else {
    currVar[path.pop()] = value;
  }
}

nowUtil.mergeScopes = function(current, incoming) {
  for(var prop in incoming){
    if(typeof incoming[prop] == "object"){
      if(!current.hasOwnProperty(prop)){
        if(nowUtil.isArray(incoming[prop])) {
          current[prop] = [];
        } else {
          current[prop] = {};
        }
      }
      nowUtil.mergeScopes(current[prop], incoming[prop]);
    } else {
      current[prop] = incoming[prop];
    }
  }
}

nowUtil.multiMergeScopes = function(current, key, incoming) {
  for(var prop in incoming){
    if(typeof incoming[prop] == "object"){
      
      var newCurrent = [];
      
      for(var i in current) {
        var curItem = current[i][key];        
        if(!curItem.hasOwnProperty(prop)){
          if(nowUtil.isArray(incoming[prop])) {
            curItem[prop] = [];
          } else {
            curItem[prop] = {};
          }
        }
        newCurrent.push(current[i][key]);
      }
      
      nowUtil.multiMergeScopes(newCurrent, prop, incoming[prop]);
    } else {
      for(var i in current) {
        current[i][key][prop] = incoming[prop];
      }
    }
  }
}


nowUtil.multiDeepCopy = function(targets, incoming) {
  if(typeof incoming == "object") {
    for(var prop in incoming){
      if(typeof incoming[prop] == "object") {
        var next = [];
        for(var i in targets){
          if(nowUtil.isArray(incoming[prop])) {
            targets[i][prop] = [];
          } else {
            targets[i][prop] = {};  
          }
          next[i] = targets[i][prop];
        }
        nowUtil.multiDeepCopy(next, incoming[prop]);
      } else {
        for(var i in targets){
          targets[i][prop] = incoming[prop];
        }
      }
    }
  } else {
    for(var i in targets){
      targets[i] = incoming;
    }
  }
  return targets;
}

nowUtil.mergeChanges = function(scopes, changes) {
  for(var fqn in changes) {
    nowUtil.multiCreateVarAtFqn(fqn, scopes, changes[fqn]);
  }
}

nowUtil.debug = function(func, msg){
  //console.log(func + ": " + msg);
}

nowUtil.error = function(err){
  console.log(err);
  if(err.hasOwnProperty('stack')){
    console.log(err.stack);
  }
}


nowUtil.print = function(msg) {
  //console.log(msg);
}

nowUtil.decycle = function decycle(object, key, funcHandlers) {
  "use strict";
  var objects = [],
      paths = [];
  return (function derez(value, path, name, fqn) {
      var i, name, nu;
      
      switch (typeof value) {
      case 'object':
          if (!value) {
              return null;
          }
          for (i = 0; i < objects.length; i += 1) {
              if (objects[i] === value) {                
                for(var i in funcHandlers) {
                  nu.push({$ref: paths[i]});
                }
                return nu;
              }
          }
          objects.push(value);
          paths.push(path);
          if (Object.prototype.toString.apply(value) === '[object Array]') {
              nu = [];
              for(var i in funcHandlers) {
                nu.push([]);
              }
              for (i = 0; i < value.length; i += 1) {
                  var values = derez(value[i], path + '[' + i + ']', i, fqn+"."+i);
                  for(var j in values) {
                    nu[j][i] = values[j];
                  }
              }
          } else {
              nu = [];
              for(var i in funcHandlers) {
                nu.push({});
              }
              for (name in value) {
                  if (Object.prototype.hasOwnProperty.call(value, name)) {
                      var values = derez(value[name], path + '[' + JSON.stringify(name) + ']', name, fqn+"."+name);
                  }
                  for(var j in values) {
                    nu[j][name] = values[j];
                  }
              }
          }
          return nu;
      case 'function':
          var output = [];
          for(var i in funcHandlers) {
            output[i] = funcHandlers[i](fqn, value);
          }
          return output;
      case 'number':
      case 'string':
      case 'boolean':
          var output = [];
          for(var i in funcHandlers) {
            output[i] = value;
          }
          return output;
      }
  }(object, '$', '', key));
};


nowUtil.retrocycle = function retrocycle($, funcHandler) {
  "use strict";
  var px = /^\$(?:\[(?:\d?|\"(?:[^\\\"\u0000-\u001f]|\\([\\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*\")\])*$/;
  (function rez(value, fqn) {
      var i, item, name, path;
      if (value && typeof value === 'object') {
          if (Object.prototype.toString.apply(value) === '[object Array]') {
              for (i = 0; i < value.length; i += 1) {
                  item = value[i];
                  if(item.hasOwnProperty("type") && item.type == 'function') {
                    value[i] = funcHandler(value[i]);
                    item = value[i];
                  }
                  if (item && typeof item === 'object') {
                      path = item.$ref;
                      if (typeof path === 'string' && px.test(path)) {
                          value[i] = eval(path);
                      } else {
                          rez(item);
                      }
                  }
              }
          } else {
              for (name in value) {
                  if (typeof value[name] === 'object') {
                      item = value[name];
                      if (item) {
                          if(item.hasOwnProperty("type") && item.type == 'function') {
                            value[name] = funcHandler(value[name]);
                            item = value[name];
                          }
                          path = item.$ref;
                          if (typeof path === 'string' && px.test(path)) {
                              value[name] = eval(path);
                          } else {
                              rez(item);
                          }
                      }
                  }
              }
          }
      }
  })($);
  return $;
};var nowLib = {};

var now = {};

var nowReadyFuncs = [];

var SERVER_ID = 'server';



now.ready = function(func) {
  // Instead of using events, we'll just add it to an array of functions that needs to be called
  if(arguments.length == 0) {
    for(var i in nowReadyFuncs) {
      nowReadyFuncs[i]();
    }
  } else {
    nowReadyFuncs.push(func); 
  }
}


var dependencies = ["/socket.io/socket.io.js"];
var dependenciesLoaded = 0;

var nowJsReady = function(){
  dependenciesLoaded++;
  if(dependenciesLoaded < dependencies.length) return;
  // Watch for server connection
  nowUtil.watch(nowCore.scopes, SERVER_ID, '', function(){
    
    // client initialized
    var nowOld = now;
    
    now = nowCore.scopes[SERVER_ID];
    
    var ready = nowOld.ready;
    
    delete nowOld.ready;
    
    nowUtil.initializeScope(nowOld, socket);
   
    nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[SERVER_ID], nowOld, "now");
    
    for(var key in nowOld) {
      now[key] = nowOld[key];
    }
   
    setInterval(function(){
      nowCore.watchers[SERVER_ID].processScope();
    }, 1000);

    
    // Call the ready handlers
    ready();
  });
  
  var socket = new io.Socket('localhost', {port: 8080}); 
  socket.connect();
  socket.on('connect', function(){ 
    var client = socket;
    client.sessionId = SERVER_ID;
    nowLib.handleNewConnection(client);
  });
}

for(var i in dependencies){
  var fileref=document.createElement('script');
  fileref.setAttribute("type","text/javascript");
  fileref.setAttribute("src", "http://localhost:8080"+dependencies[i]);
  fileref.onload = nowJsReady;
  document.getElementsByTagName("head")[0].appendChild(fileref);
}



nowLib.NowWatcher = function(fqnRoot, scopeObj, variableChanged) {
  this.data = {watchedKeys: {}, hashedArrays: {}};
  
  this.traverseObject = function(path, obj, arrayBlacklist) {
    // Prevent new array items from being double counted
    for(var key in obj){
      var fqn = path+"."+key;
      
      // Ignore ready function
      if(fqn == 'now.ready') {
        return;
      }
      
      if(!this.data.watchedKeys.hasOwnProperty(fqn)) {
        nowUtil.watch(obj, key, fqn, this.variableChanged);
        if(!arrayBlacklist.hasOwnProperty(fqn)) {
          this.variableChanged(key, fqn, "", obj[key]);
        }
        this.data.watchedKeys[fqn] = true;
      }
      
      if(typeof obj[key] == 'object') {
        if(nowUtil.isArray(obj[key])) {
          if(this.data.hashedArrays.hasOwnProperty(fqn)){
            var diff = this.compareArray(this.data.hashedArrays[fqn], obj[key]);
            if(diff === false) {
              // Replace the whole array
              this.variableChanged(key, fqn, this.data.hashedArrays[fqn], []);
            } else if(diff !== true) {
              for(var i in diff) {
                arrayBlacklist[fqn+"."+i] = true;
                this.variableChanged(i, fqn+"."+i, this.data.hashedArrays[fqn][i], diff[i]);
              }  
            }
          }
          this.data.hashedArrays[fqn] = obj[key].slice(0); 
        } 
        this.traverseObject(fqn, obj[key], arrayBlacklist);
      }
    }
  }

  this.processScope = function(){
    this.traverseObject(fqnRoot, scopeObj, {});
  }

  this.variableChanged = variableChanged;

   /** 
   * Returns true if two the two arrays are identical. 
   * Returns an object of differences if keys have been added or the value at a key has changed
   * Returns false if keys have been deleted
   */
  this.compareArray = function(oldArr, newArr) {
    var result = {};
    var modified = false;
    if(newArr.length >= oldArr.length) {
      for(var i in newArr) {
        if(!oldArr.hasOwnProperty(i) || newArr[i] !== oldArr[i]) {
          result[i] = newArr[i];
          modified = true;
        }
      }
      return (modified) ? result : true;
    } else {
      return false;
    }
  }
}


nowLib.handleNewConnection = function(client){

  client.on('message', function(message){
    var messageObj = message;
    if(messageObj != null && messageObj.hasOwnProperty("type") && nowCore.messageHandlers.hasOwnProperty(messageObj.type)) {
        nowCore.messageHandlers[messageObj.type](client, messageObj.data);
    }
  });
  
  client.on('disconnect', function(){
    nowCore.handleDisconnection(client);  
  });
}




var nowCore = {};
nowCore.scopes = {};
nowCore.watchers = {};
nowCore.watchersBlacklist = {};
nowCore.callbacks = {};
nowCore.messageHandlers = {};
nowCore.closures = {};

nowLib.nowCore = nowCore;

/* ===== BEGIN MESSAGE HANDLERS ===== */
nowCore.messageHandlers.remoteCall = function(client, data){
  nowUtil.debug("handleRemoteCall", data.callId)
  var clientScope = nowCore.scopes[client.sessionId];
  
  var theFunction;
  if(data.functionName.split('_')[0] == 'closure'){
    theFunction = nowCore.closures[data.functionName];
  } else {
    theFunction = nowUtil.getVarFromFqn(data.functionName, clientScope);
  }
  
  var theArgs = data.arguments;
  
  
  for(var i in theArgs){
    if(theArgs[i].hasOwnProperty('type') && theArgs[i].type == 'function'){
      theArgs[i] = nowCore.constructRemoteFunction(client, theArgs[i].fqn);
    }
  }
  
  var callId = data.callId;
  var response = {type:"callReturn", data: {callId: callId}};
  try {
    var retval = theFunction.apply({now: clientScope}, theArgs);
    
    if(typeof retval == 'function'){
      var closureId = "closure" + "_" + retval.name + "_" + new Date().getTime();
      nowCore.closures[closureId] = retval;
      retval = {type: 'function', fqn: closureId};
    }
    
    response.data.retval = retval;
  } catch(err) {
    nowUtil.debug("remoteCallReturn", err.stack);
    response.data.err = err;
  }
  if(data.callReturnExpected){
    client.send(nowUtil.decycle(response));
  }
  nowUtil.debug("handleRemoteCall" , "completed " + callId);
}

nowCore.messageHandlers.callReturn = function(client, data){
  nowUtil.debug("handleCallReturn", data.callId);
  var callback = nowCore.callbacks[client.sessionId][data.callId];
  if(data.hasOwnProperty('err')){
    callback(data.err);
  } else if (data.hasOwnProperty('retval')){
  
    if(data.retval.hasOwnProperty('type') && data.retval.type == 'function'){
      data.retval = nowCore.constructRemoteFunction(client, data.retval.fqn);
    }
    
    callback(data.retval);
  } else {
    callback();
  }
  delete nowCore.callbacks[client.sessionId][data.callId];
}

nowCore.messageHandlers.createScope = function(client, data){
  nowCore.watchersBlacklist[client.sessionId] = {};
  var scope = nowUtil.retrocycle(data.scope, nowCore.constructHandleFunctionForClientScope(client));
  
  nowUtil.debug("handleCreateScope", "");
  nowUtil.print(scope);
  

  // Blacklist the entire scope so it is not sent back to the client
  nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[client.sessionId], scope, "now");
  
  nowCore.watchers[client.sessionId] = new nowLib.NowWatcher("now", scope, function(prop, fqn, oldVal, newVal){
    if(!nowCore.watchersBlacklist[client.sessionId].hasOwnProperty(fqn)){
      nowUtil.debug("clientScopeWatcherVariableChanged", fqn + " => " + newVal);
      if(typeof oldVal == "object") {
        var oldFqns = nowUtil.getAllChildFqns(oldVal, fqn);
        
        for(var i in oldFqns) {
          delete nowCore.watchers[client.sessionId].data.watchedKeys[oldFqns[i]];  
        }
      }
      
      
      nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[client.sessionId], newVal, fqn);
      
      var key = fqn.split(".")[1];
      var data = nowUtil.decycle(scope[key], key, [nowUtil.serializeFunction]);
      
      client.send({type: 'replaceVar', data: {key: key, value: data[0]}});    
    } else {
      nowUtil.debug("clientScopeWatcherVariableChanged", fqn + " change ignored");
      delete nowCore.watchersBlacklist[client.sessionId][fqn];
    }
    
    // In case the object is an array, we delete from hashedArrays to prevent multiple watcher firing
    delete nowCore.watchers[client.sessionId].data.hashedArrays[fqn];
    
  });
  nowCore.scopes[client.sessionId] = scope;

}


nowCore.constructHandleFunctionForClientScope = function(client) {
  return function(funcObj) {
    return nowCore.constructRemoteFunction(client, funcObj.fqn);
  }
}


nowCore.messageHandlers.replaceVar = function(client, data){

  nowUtil.debug("handleReplaceVar", data.key + " => " + data.value);
  
  var scope = nowCore.scopes[client.sessionId];
  
  
  var newVal = nowUtil.retrocycle(data.value, nowCore.constructHandleFunctionForClientScope(client));

  nowCore.watchersBlacklist[client.sessionId]["now."+data.key] = true;
  
  nowUtil.addChildrenToBlacklist(nowCore.watchersBlacklist[client.sessionId], newVal, "now."+data.key);
  
  for(var key in nowCore.watchers[client.sessionId].data.watchedKeys) {
    if(key.indexOf("now."+data.key+".") === 0) {
      delete nowCore.watchers[client.sessionId].data.watchedKeys[key];
    }
  }
    
  scope[data.key] = newVal;

}

/* ===== END MESSAGE HANDLERS ====== */

nowCore.handleDisconnection = function(client) {
  //Remove scope and callbacks
  setTimeout(function(){
    if(!client.connected) {
      delete nowCore.scopes[client.sessionId];
      delete nowCore.callbacks[client.sessionId];
      delete nowCore.watchers[client.sessionId];
      delete nowCore.watchersBlacklist[client.sessionId];
      delete nowCore.closures[client.sessionId];
    }    
  }, 10000)
}


nowCore.constructRemoteFunction = function(client, functionName){
  
  nowUtil.debug("constructRemoteFunction", functionName);
    
  var remoteFn = function(){
    var callId = functionName+ "_"+ new Date().getTime();
    
    nowUtil.debug("executeRemoteFunction", functionName + ", " + callId);

    arguments = Array.prototype.slice.call(arguments);
    if(typeof arguments[arguments.length-1] == "function") {
      var callback = arguments.pop();
      var callReturnExpected = true;
    } else {
      var callReturnExpected = false;
    }
    
    for(var i in arguments){
      if(typeof arguments[i] == 'function'){
        var closureId = "closure" + "_" + arguments[i].name + "_" + new Date().getTime();
        nowCore.closures[closureId] = arguments[i];
        arguments[i] = {type: 'function', fqn: closureId};
      }
    }
    //Register the callback in the callbacks table
    if(!nowCore.callbacks[client.sessionId]){
      nowCore.callbacks[client.sessionId] = {};
    }
    
    if(callback){
      nowCore.callbacks[client.sessionId][callId] = callback;
    }
    
    client.send({type: 'remoteCall', data: {callId: callId, functionName: functionName, arguments: arguments, callReturnExpected: callReturnExpected}});
    
    return true;
  }
  return remoteFn;
}

