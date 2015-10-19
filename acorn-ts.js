var acornTS = function(acorn) {
  var tt = acorn.tokTypes;
  var tc = acorn.tokContexts;
  var pp = acorn.Parser.prototype;
  
  pp.flowParseTypeInitialiser = function (tok) {
    var oldInType = this.inType; //this.state.inType;
    this.inType = true; //this.state.inType = true; 
    this.expect(tok || tt.colon);
    var type = this.flowParseType();
    this.state.inType = oldInType;
    return type;
  };
  
  pp.flowParseTypeAnnotation = function () {
    var node = this.startNode();
    node.typeAnnotation = this.flowParseTypeInitialiser();
    return this.finishNode(node, "TypeAnnotation");
  };
  
  function match(tok, type) {
    return tok.type === type
  };
  
  acorn.plugins.ts = function(instance) {
    
    // var foo: string = bar
    instance.extend("parseVarId", function (inner) {
      return function (decl) {
        inner.call(this, decl);
        if (match(this.type, tt.colon)) {
          decl.id.typeAnnotation = this.flowParseTypeAnnotation();
          this.finishNode(decl.id, decl.id.type);
        }
      };
    });
    
  }
  
  return acorn;
}