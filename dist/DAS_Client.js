"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAS_Client = void 0;
var net_1 = require("net");
var stream_1 = require("stream");
var async = require('async');
var net = require('net');
var events = require('events');
var uuid = require('uuid');
var xmlToJsonParser = require('fast-xml-parser');
var jsonToXmlParser = require("fast-xml-parser").j2xParser;
var he = require('he');
var DAS_Client = /** @class */ (function (_super) {
    __extends(DAS_Client, _super);
    function DAS_Client(host, port) {
        if (port === void 0) { port = 64079; }
        var _this = _super.call(this, { objectMode: true }) || this;
        _this.uuid = "";
        _this._readingPaused = false;
        _this.uuid = new uuid.uuidv4();
        _this.host = host;
        _this.port = port;
        _this._readingPaused = false;
        _this.connect(host = _this.host, port = _this.port);
        return _this;
    }
    DAS_Client.prototype.connect = function (host, port) {
        this._wrapSocket(new net_1.Socket());
        this._socket.connect({ host: host, port: port });
        return this;
    };
    DAS_Client.prototype._wrapSocket = function (socket) {
        var _this = this;
        this._socket = socket;
        this._socket.on('close', function (hadError) { return _this.emit('close', hadError); });
        this._socket.on('connect', function () { return _this.emit('connect'); });
        this._socket.on('drain', function () { return _this.emit('drain'); });
        this._socket.on('end', function () { return _this.emit('end'); });
        this._socket.on('error', function (err) { return _this.emit('error', err); });
        this._socket.on('lookup', function (err, address, family, host) { return _this.emit('lookup', err, address, family, host); }); // prettier-ignore
        this._socket.on('ready', function () { return _this.emit('ready'); });
        this._socket.on('timeout', function () { return _this.emit('timeout'); });
        this._socket.on('readable', this._onReadable.bind(this));
    };
    DAS_Client.prototype._onReadable = function () {
        // Read all the data until one of two conditions is met
        // 1. there is nothing left to read on the socket
        // 2. reading is paused because the consumer is slow
        while (!this._readingPaused) {
            // First step is reading the 32-bit integer from the socket
            // and if there is not a value, we simply abort processing
            //let lenBuf = this._socket.read(4);
            var len = this._socket.readableLength;
            if (!len)
                return;
            // Now that we have a length buffer we can convert it
            // into a number by reading the UInt32BE value
            // from the buffer.
            //let len = lenBuf.readUInt32BE();
            // ensure that we don't exceed the max size of 256KiB
            if (len > Math.pow(2, 18)) {
                this._socket.destroy(new Error('Max length exceeded'));
                console.log("Max length exceeded");
                return;
            }
            // With the length, we can then consume the rest of the body.
            var body = this._socket.read(len);
            // If we did not have enough data on the wire to read the body
            // we will wait for the body to arrive and push the length
            // back into the socket's read buffer with unshift.
            if (!body) {
                this._socket.unshift(body);
                console.log("Not enough bytes to read based on readableLength");
                return;
            }
            //first parse XML and convert to JSON for easy manipulation and events
            var options = {
                arrayMode: false
            };
            var valid = xmlToJsonParser.validate(body);
            if (valid === true) { //optional (it'll return an object in case it's not valid)
                var jsonObj = xmlToJsonParser.parse(body, options);
            }
            else {
                console.log(valid.message);
                this._socket.unshift(body);
                return;
            }
            // Try to parse the data and if it fails destroy the socket.
            var json = void 0;
            try {
                json = JSON.parse(body);
            }
            catch (ex) {
                this._socket.destroy(ex);
                console.log(ex.message);
                return;
            }
            // Push the data into the read buffer and capture whether
            // we are hitting the back pressure limits
            var pushOk = this.push(json);
            // When the push fails, we need to pause the ability to read
            // messages because the consumer is getting backed up.
            if (!pushOk)
                this._readingPaused = true;
        }
    };
    // _onData(data: DAS_Root[]){
    // 	async.each(data, _dataParser = (response: DAS_Root, callback: any) => {
    // 		var responseArray = response.toString().split(":");
    // 		// responseArray[0] = (config.type ie lightbulbs) : responseArray[1] = (id) : responseArray[2] = (command ie getPowerState) : responseArray[3] = (value)
    // 		if (responseArray[0] != "") {
    // 			this.emit(responseArray[0] + ":" + responseArray[1] + ":" + responseArray[2], parseInt(responseArray[3])); // convert string to value
    // 			//this.log("EMIT: " + responseArray[0] + ":" + responseArray[1] + ":" + responseArray[2] + " = " + responseArray[3]);
    // 		}
    // 		callback();
    // 	}.bind(this), function (err: any) {
    // 		//console.log("SockedRx Processed");
    // 	});
    // }
    /**
    Implements the readable stream method `_read`. This method will
    flagged that reading is no longer paused since this method should
    only be called by a consumer reading data.
    @private
    */
    DAS_Client.prototype._read = function () {
        this._readingPaused = false;
        setImmediate(this._onReadable.bind(this));
    };
    /**
Implements the writeable stream method `_write` by serializing
the object and pushing the data to the underlying socket.
*/
    DAS_Client.prototype._write = function (obj, encoding, cb) {
        var parser = new jsonToXmlParser();
        var xmlBody = parser.parse(obj);
        var xmlBytes = Buffer.byteLength(xmlBody);
        var jsonTrans = { body: obj, bodySize: xmlBytes };
        var jsonRoot = { DAS_Transmission: jsonTrans };
        var xml = parser.parse(jsonRoot);
        console.log(xml);
        var transBytes = Buffer.byteLength(xml);
        var buffer = Buffer.alloc(transBytes);
        buffer.write(xml, 0);
        this._socket.write(buffer, cb);
    };
    /**
    Implements the writeable stream method `_final` used when
    .end() is called to write the final data to the stream.
    */
    DAS_Client.prototype._final = function (cb) {
        this._socket.end(cb);
    };
    DAS_Client.prototype.setIPAddress = function (newHost) {
        //close current connection
        this.host = newHost;
        //reset buffers
        //open new connection with new address
    };
    DAS_Client.prototype.setPortNumber = function (newPort) {
        //close current connection
        this.port = newPort;
        //reset buffers
        //open new connection with new address
    };
    return DAS_Client;
}(stream_1.Duplex));
exports.DAS_Client = DAS_Client;
