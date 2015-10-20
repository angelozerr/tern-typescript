(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        return mod(require("tern/lib/infer"), require("tern/lib/tern"), require("acorn/dist/acorn"), require("acorn/dist/walk"), require("acorn-ts"));
    if (typeof define == "function" && define.amd) // AMD
        return define([ "tern/lib/infer", "tern/lib/tern", "acorn/dist/acorn", "acorn/dist/walk", "acorn-ts" ], mod);
    mod(tern, tern, acorn, acorn.walk, acornTS); // Plain browser env
})(function(infer, tern, acorn, walk, acornTS) {
  "use strict";
  
  var WG_MADEUP = 101;
  
  tern.registerPlugin("typescript", function(server, options) {
    acornTS(acorn);
    server.on("preParse", preParse);
    server.on("postInfer", postInfer);
  });
  
  function preParse(text, options) {
    var plugins = options.plugins;
    if (!plugins) plugins = options.plugins = {};   
    plugins["ts"] = true;
  }
  
  function postInfer(ast, scope) {
    walk.simple(ast, {
      VariableDeclaration: function(node, scope) {
        for (var i = 0; i < node.declarations.length; ++i) {
          var decl = node.declarations[i];
          if (decl.id.typeAnnotation) {
            var type;
            var aval = scope.getProp(decl.id.name);
            var ann = decl.id.typeAnnotation.typeAnnotation;
            switch(ann.type) {
              case "BooleanTypeAnnotation":
                type = infer.cx().bool;
                break;
            }
            if (type) type.propagate(aval, WG_MADEUP);
          }
        }
        //if (node.commentsBefore)
        //  interpretComments(node, node.commentsBefore, scope,
        //                    scope.getProp(node.declarations[0].id.name));
      }
    }, infer.searchVisitor, scope);
  }
})  