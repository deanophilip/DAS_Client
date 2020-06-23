/// <reference types="node" />
import { Socket } from "net";
import { Duplex } from "stream";
export interface DAS_Body {
    signalType: string;
    index: number;
    command: string;
    value: string;
}
export interface DAS_Transmission {
    bodySize: number;
    body: DAS_Body;
}
export interface DAS_Root {
    DAS_Transmission: DAS_Transmission;
}
export declare class DAS_Client extends Duplex {
    private uuid;
    protected host: string;
    protected port: number;
    private _readingPaused;
    protected _socket: Socket;
    constructor(host: string, port?: number);
    connect(host: string, port: number): this;
    _wrapSocket(socket: Socket): void;
    private _onReadable;
    /**
    Implements the readable stream method `_read`. This method will
    flagged that reading is no longer paused since this method should
    only be called by a consumer reading data.
    @private
    */
    _read(): void;
    /**
Implements the writeable stream method `_write` by serializing
the object and pushing the data to the underlying socket.
*/
    _write(obj: DAS_Body, encoding: any, cb: ((err?: Error | undefined) => void) | undefined): void;
    /**
    Implements the writeable stream method `_final` used when
    .end() is called to write the final data to the stream.
    */
    _final(cb: (() => void) | undefined): void;
    setIPAddress(newHost: string): void;
    setPortNumber(newPort: number): void;
}
