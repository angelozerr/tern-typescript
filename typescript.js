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
    acornTS(acorn, true);
    //acornTS(acorn_loose);
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
          if (decl.id) {
            interpretTypeAnnotations(decl.id, scope,
                scope.getProp(decl.id.name));            
          }
        }
      },
      FunctionDeclaration: function(node, scope) {
        console.log(node)
      }
    }, infer.searchVisitor, scope);
  }
  
  function interpretTypeAnnotations(node, scope, aval) {
    if (!node.typeAnnotation) return;
    var type, args, ret, foundOne, self, parsed;

    /*for (var i = 0; i < comments.length; ++i) {
      var comment = comments[i];
      var decl = /(?:\n|$|\*)\s*@(type|param|arg(?:ument)?|returns?|this)\s+(.*)/g, m;
      while (m = decl.exec(comment)) {
        if (m[1] == "this" && (parsed = parseType(scope, m[2], 0))) {
          self = parsed;
          foundOne = true;
          continue;
        }

        if (!(parsed = parseTypeOuter(scope, m[2]))) continue;
        foundOne = true;

        switch(m[1]) {
        case "returns": case "return":
          ret = parsed; break;
        case "type":
          type = parsed; break;
        case "param": case "arg": case "argument":
            var name = m[2].slice(parsed.end).match(/^\s*(\[?)\s*([^\]\s=]+)\s*(?:=[^\]]+\s*)?(\]?).*///);
      /*      if (!name) continue;
            var argname = name[2] + (parsed.isOptional || (name[1] === '[' && name[3] === ']') ? "?" : "");
          (args || (args = Object.create(null)))[argname] = parsed;
          break;
        }
      }
    }*/

    type = parseType(scope, node.typeAnnotation.typeAnnotation);
    if (type && type.type) applyType(type, self, args, ret, node, aval);
  };

  function parseType(scope, typeAnnotation) {
    var type, isOptional;
    switch(typeAnnotation.type) {
    case "StringTypeAnnotation":
      type = infer.cx().str;
      break;
    case "BooleanTypeAnnotation":
      type = infer.cx().bool;
      break;                
    }
    
    /*var type, union = false, madeUp = false;
    for (;;) {
      var inner = parseTypeInner(scope, str, pos);
      if (!inner) return null;
      madeUp = madeUp || inner.madeUp;
      if (union) inner.type.propagate(union);
      else type = inner.type;
      pos = skipSpace(str, inner.end);
      if (str.charAt(pos) != "|") break;
      pos++;
      if (!union) {
        union = new infer.AVal;
        type.propagate(union);
        type = union;
      }
    }
    var isOptional = false;
    if (str.charAt(pos) == "=") {
      ++pos;
      isOptional = true;
    }*/
    
    
    return {type: type, isOptional: isOptional};
  }
  
  function propagateWithWeight(type, target) {
    var weight = WG_MADEUP; //infer.cx().parent.mod.docComment.weight;
    type.type.propagate(target, weight || (type.madeUp ? WG_MADEUP : undefined));
  }

  function isFunExpr(node) { return node.type == "FunctionExpression" || node.type == "ArrowFunctionExpression" }

  function applyType(type, self, args, ret, node, aval) {
    var fn;
    if (node.type == "Identifier") {
      //var decl = node.declarations[0];
      //if (decl.init && isFunExpr(decl.init)) fn = decl.init.scope.fnType;
    } else if (node.type == "FunctionDeclaration") {
      fn = node.scope.fnType;
    } else if (node.type == "AssignmentExpression") {
      if (isFunExpr(node.right))
        fn = node.right.scope.fnType;
    } else if (node.type == "CallExpression") {
    } else { // An object property
      if (isFunExpr(node.value)) fn = node.value.scope.fnType;
    }

    if (fn && (args || ret || self)) {
      if (args) for (var i = 0; i < fn.argNames.length; ++i) {
        var name = fn.argNames[i], known = args[name];
        if (!known && (known = args[name + "?"]))
          fn.argNames[i] += "?";
        if (known) propagateWithWeight(known, fn.args[i]);
      }
      if (ret) {
        if (fn.retval == infer.ANull) fn.retval = new infer.AVal;
        propagateWithWeight(ret, fn.retval);
      }
      if (self) propagateWithWeight(self, fn.self);
    } else if (type) {
      propagateWithWeight(type, aval);
    }
  };  
})  