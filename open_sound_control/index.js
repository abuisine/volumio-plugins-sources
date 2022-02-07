'use strict';

var libQ = require('kew');
var osc = require('osc-min');
var dgram = require('dgram');

module.exports = openSoundControl;
function openSoundControl(context) {
	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

	this.remote = null;
	this.udp = null;
}

openSoundControl.prototype.onVolumioStart = function() {
	var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
	return libQ.resolve();
}

openSoundControl.prototype.onStart = function() {
	var defer=libQ.defer();

	// listen for OSC messages and print them to the console
	this.udp = dgram.createSocket('udp4',  this.onDatagram.bind(this));

	this.udp.bind(this.config.get('osc_udp_local_port'));
	this.logger.info(`Listening for OSC messages on port ${this.config.get('osc_udp_local_port')}`);

	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

	return defer.promise;
};

openSoundControl.prototype.onStop = function() {
	var defer=libQ.defer();

	this.udp.close();

	// Once the Plugin has successfull stopped resolve the promise
	defer.resolve();

	return libQ.resolve();
};

openSoundControl.prototype.onRestart = function() {
	this.onStop().then(this.onStart());
};

openSoundControl.prototype.onDatagram = function(msg, rinfo) {
	this.remote = rinfo.address;
	var onMessage = {
		'/play': this.onMessagePlay,
		'/stop': this.onMessageStop,
		'/getstate': this.onMessageGetState,
		'/setvolume': this.onMessageSetVolume
	};

	try {
		var message = osc.fromBuffer(msg);
		this.logger.debug(`received message : ${message.address}`);
		if ( onMessage[message.address] )
			onMessage[message.address].call(this, message.args);
		else
			this.logger.warn("message type unknown");
	} catch (err) {
		this.logger.error('Could not decode OSC message', err);
	}

};

openSoundControl.prototype.onMessagePlay = function(args) {
	this.logger.info("play request");
	this.commandRouter.replaceAndPlay({
				"item": {
					"uri": `${args[0].value}`,
					"service": "mpd",
					"trackType": "mp3"
				}});
};

openSoundControl.prototype.onMessageStop = function(args) {
	this.logger.info("stop request");
	this.commandRouter.volumioStop();
};

openSoundControl.prototype.onMessageGetState = function(args) {
	this.logger.info("get state request");
	var state = this.commandRouter.volumioGetState();
	console.log(state);
};

openSoundControl.prototype.onMessageSetVolume = function(args) {
	this.logger.info("set volume request");
	this.commandRouter.volumiosetvolume(args[0].value);
};

// Configuration Methods -----------------------------------------------------------------------------

openSoundControl.prototype.saveConf = function (data) {
	for (const key in data) {
		this.config.set(key, data[key]);
	};
	this.onRestart();
};

openSoundControl.prototype.getUIConfig = function() {
	var defer = libQ.defer();

	var lang_code = this.commandRouter.sharedVars.get('language_code');
	var config = this.config;

	this.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
		__dirname+'/i18n/strings_en.json',
		__dirname + '/UIConfig.json')
		.then(function(uiconf)
		{
			for (var key of config.getKeys()) {
				console.log("key", key);
				var idx = uiconf.sections[0].contents.findIndex(content => content.id == key);
				console.log(idx, content.id, key);

				if (idx >= 0) {
					uiconf.sections[0].contents[idx].value = config.get(key);
				}
			}
			defer.resolve(uiconf);
		})
		.fail(function()
		{
			defer.reject(new Error());
		});

	return defer.promise;
};

openSoundControl.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

openSoundControl.prototype.setUIConfig = function(data) {
	//Perform your installation tasks here
	this.logger.debug(data);
};

openSoundControl.prototype.getConf = function(varName) {
	//Perform your installation tasks here
	this.logger.debug(varName);
};

openSoundControl.prototype.setConf = function(varName, varValue) {
	//Perform your installation tasks here
	this.logger.debug(varName, varValue);
};