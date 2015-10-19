(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        return mod(require("tern/lib/infer"), require("tern/lib/tern"), require("acorn/dist/acorn"), require("acorn/dist/walk"), require("acorn-ts"));
    if (typeof define == "function" && define.amd) // AMD
        return define([ "tern/lib/infer", "tern/lib/tern", "acorn/dist/acorn", "acorn/dist/walk", "acorn-ts" ], mod);
    mod(tern, tern, acorn, acorn.walk, acornTS); // Plain browser env
})(function(infer, tern, acorn, walk, acornTS) {
  "use strict";
  
  tern.registerPlugin("typescript", function(server, options) {
    acornTS(acorn);
    server.on("preParse", preParse);
  });
  
  function preParse(text, options) {
    var plugins = options.plugins;
    if (!plugins) plugins = options.plugins = {};   
    plugins["ts"] = true;
  }  

})  