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
//import uuid, not @types/uuid
// eslint-disable-next-line @typescript-eslint/no-var-requires
var uuid_1 = require("uuid");
//import as JS
// eslint-disable-next-line @typescript-eslint/no-var-requires
var xmlToJsonParser = require("fast-xml-parser");
//import as JS
// eslint-disable-next-line @typescript-eslint/no-var-requires
var jsonToXmlParser = require("fast-xml-parser").j2xParser;
var DAS_Client = /** @class */ (function (_super) {
    __extends(DAS_Client, _super);
    function DAS_Client(host, port) {
        if (port === void 0) { port = 64079; }
        var _this = _super.call(this, { objectMode: true }) || this;
        // eslint-disable-next-line @typescript-eslint/no-inferrable-types
        _this.uuid = "";
        _this._readingPaused = false;
        _this.uuid = uuid_1.v4();
        _this.host = host;
        _this.port = port;
        _this._readingPaused = false;
        _this.connect(host = _this.host, port = _this.port);
        return _this;
    }
    //connect to a new socket, should only be used when the socket is disconnected/destroyed
    DAS_Client.prototype.connect = function (host, port) {
        this._wrapSocket(new net_1.Socket());
        if (port) {
            this._socket.connect(port, host);
        }
        else {
            this._socket.connect(this.port, host);
        }
        return this;
    };
    DAS_Client.prototype.disconnect = function () {
        this._socket.destroy();
        return;
    };
    //uses the events coming from the socket, and forwards them, but customizes the readable event.
    DAS_Client.prototype._wrapSocket = function (socket) {
        var _this = this;
        this._socket = socket;
        this._socket.on("close", function (hadError) { return _this.emit("close", hadError); });
        this._socket.on("connect", function () { return _this.emit("connect"); });
        this._socket.on("drain", function () { return _this.emit("drain"); });
        this._socket.on("end", function () { return _this.emit("end"); });
        this._socket.on("error", function (err) { return _this.emit("error", err); });
        this._socket.on("lookup", function (err, address, family, host) { return _this.emit("lookup", err, address, family, host); }); // prettier-ignore
        this._socket.on("ready", function () { return _this.emit("ready"); });
        this._socket.on("timeout", function () { return _this.emit("timeout"); });
        this._socket.on("readable", this._onReadable.bind(this));
    };
    /**
     * Creates a private function that handles the incoming socket data and parses the XML into a json format.
     * Supports back pressure, not that it should be needed.
     */
    DAS_Client.prototype._onReadable = function () {
        // Read all the data until one of two conditions is met
        // 1. there is nothing left to read on the socket
        // 2. reading is paused because the consumer is slow
        while (!this._readingPaused) {
            // Without a length parameter, we can then consume the entire input buffer.
            var body = this._socket.read();
            // Null body tells us that there is no readable data, and that we can return.
            if (!body) {
                //console.log("Not enough bytes to read based on readableLength: %s", body);
                return;
            }
            //first parse XML and convert to JSON for easy manipulation and events
            var options = {
                arrayMode: false
            };
            var valid = xmlToJsonParser.validate(body.toString());
            var jsonObj = void 0;
            if (valid === true) { //optional (it'll return an object in case it's not valid)
                jsonObj = xmlToJsonParser.parse(body.toString(), options);
                //console.log("XML shifted to JSON: %s", jsonObj);
            }
            else {
                console.log(valid.message);
                this._socket.unshift(body);
                return;
            }
            // Push the data into the read buffer and capture whether
            // we are hitting the back pressure limits
            var pushOk = this.push(jsonObj);
            // When the push fails, we need to pause the ability to read
            // messages because the consumer is getting backed up.
            if (!pushOk)
                this._readingPaused = true;
            return;
        }
    };
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
        var jsonRoot = { DAS_transmission: jsonTrans };
        var xml = parser.parse(jsonRoot);
        //console.log(xml);
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
        return;
    };
    return DAS_Client;
}(stream_1.Duplex));
exports.DAS_Client = DAS_Client;
