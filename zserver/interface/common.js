
/**
 * @template T
 * @typedef InterfaceReturn
 * @type {({okay:false}&({iserror:true,err:Error}|{iserror:false,err:{status:number,msg:string}}))|({okay:true,value:T})}
 */

/**
 * @template T
 * @param {import("http").ClientRequest} req
 * @param {(value:InterfaceReturn<T>)} resolve
 * @param {(data:string)=>T} endcb
 */
function attatchListeners(req, resolve, endcb) {
    endcb = endcb ?? ((data)=>null);
    req.once("error", (e) => resolve({okay:false,iserror:true,err:e}));
    req.on("response", (res) => {
        res.once("error", (e) => resolve({okay:false,iserror:true,err:e}));
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({okay:true,value:endcb(data)});
            } else {
                resolve({okay:false,iserror:false,err:data});
            }
        });
    });
}

exports.attatchListeners = attatchListeners;
exports.InterfaceReturn = this.InterfaceReturn;
