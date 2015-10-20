var acornTS = function(acorn, loose) {
  var tt = acorn.tokTypes;
  var tc = acorn.tokContexts;
  var pp = loose ? acorn.LooseParser.prototype : acorn.Parser.prototype;
  
  if (loose) {
    pp.extend = function extend(name, f) {
      this[name] = f(this[name]);
    };
    
    pp.extend("parseIdent", function (inner) {
      return function (decl) {
        var id = inner.call(this, decl);
        if (this.eat(tt.colon)) {
          id.typeAnnotation = this.flowParseTypeAnnotation();
          this.finishNode(id, id.type);
        }
        return id;
      };
    });
  }
  
  // Type annotations

  pp.flowParseTypeParameterDeclaration = function () {
    var node = this.startNode();
    node.params = [];

    this.expectRelational("<");
    while (!this.isRelational(">")) {
      node.params.push(this.flowParseTypeAnnotatableIdentifier());
      if (!this.isRelational(">")) {
        this.expect(tt.comma);
      }
    }
    this.expectRelational(">");

    return this.finishNode(node, "TypeParameterDeclaration");
  };
  
  pp.flowIdentToTypeAnnotation = function (startPos, startLoc, node, id) {
    switch (id.name) {
      case "any":
        return this.finishNode(node, "AnyTypeAnnotation");

      case "void":
        return this.finishNode(node, "VoidTypeAnnotation");

      case "bool":
      case "boolean":
        return this.finishNode(node, "BooleanTypeAnnotation");

      case "mixed":
        return this.finishNode(node, "MixedTypeAnnotation");

      case "number":
        return this.finishNode(node, "NumberTypeAnnotation");

      case "string":
        return this.finishNode(node, "StringTypeAnnotation");

      default:
        return this.flowParseGenericType(startPos, startLoc, id);
    }
  };
  
  //The parsing of types roughly parallels the parsing of expressions, and
  //primary types are kind of like primary expressions...they're the
  //primitives with which other types are constructed.
  pp.flowParsePrimaryType = function () {
   var startPos = this.start  || this.tok.start, startLoc = this.startLoc;
   var node = this.startNode();
   var tmp;
   var type;
   var isGroupedType = false;
   var nodeType = this.type || this.tok.type;
   switch (nodeType) {
     case tt.name:
       return this.flowIdentToTypeAnnotation(startPos, startLoc, node, this.parseIdent());
  
     case tt.braceL:
       return this.flowParseObjectType();
  
     case tt.bracketL:
       return this.flowParseTupleType();
  
     case tt.relational:
       if (this.value === "<") {
         node.typeParameters = this.flowParseTypeParameterDeclaration();
         this.expect(tt.parenL);
         tmp = this.flowParseFunctionTypeParams();
         node.params = tmp.params;
         node.rest = tmp.rest;
         this.expect(tt.parenR);
  
         this.expect(tt.arrow);
  
         node.returnType = this.flowParseType();
  
         return this.finishNode(node, "FunctionTypeAnnotation");
       }
  
     case tt.parenL:
       this.next();
  
       // Check to see if this is actually a grouped type
       if (!match(this, tt.parenR) && !match(this, tt.ellipsis)) {
         if (match(this, tt.name)) {
           var token = this.lookahead().type;
           isGroupedType = token !== tt.question && token !== tt.colon;
         } else {
           isGroupedType = true;
         }
       }
  
       if (isGroupedType) {
         type = this.flowParseType();
         this.expect(tt.parenR);
  
         // If we see a => next then someone was probably confused about
         // function types, so we can provide a better error message
         if (this.eat(tt.arrow)) {
           this.raise(node,
             "Unexpected token =>. It looks like " +
             "you are trying to write a function type, but you ended up " +
             "writing a grouped type followed by an =>, which is a syntax " +
             "error. Remember, function type parameters are named so function " +
             "types look like (name1: type1, name2: type2) => returnType. You " +
             "probably wrote (type1) => returnType"
           );
         }
  
         return type;
       }
  
       tmp = this.flowParseFunctionTypeParams();
       node.params = tmp.params;
       node.rest = tmp.rest;
  
       this.expect(tt.parenR);
  
       this.expect(tt.arrow);
  
       node.returnType = this.flowParseType();
       node.typeParameters = null;
  
       return this.finishNode(node, "FunctionTypeAnnotation");
  
     case tt.string:
       node.rawValue = node.value = this.value;
       node.raw = this.input.slice(this.start, this.end);
       this.next();
       return this.finishNode(node, "StringLiteralTypeAnnotation");
  
     case tt._true: case tt._false:
       node.value = match(this, tt._true);
       this.next();
       return this.finishNode(node, "BooleanLiteralTypeAnnotation");
  
     case tt.num:
       node.rawValue = node.value = this.value;
       node.raw = this.input.slice(this.start, this.end);
       this.next();
       return this.finishNode(node, "NumberLiteralTypeAnnotation");
  
     default:
       if (this.type.keyword === "typeof") {
         return this.flowParseTypeofType();
       }
   }
  
   this.unexpected();
  };

  pp.flowParsePostfixType = function () {
    var node = this.startNode();
    var type = node.elementType = this.flowParsePrimaryType();
    if (match(this, tt.bracketL)) {
      this.expect(tt.bracketL);
      this.expect(tt.bracketR);
      return this.finishNode(node, "ArrayTypeAnnotation");
    } else {
      return type;
    }
  };
  
  pp.flowParsePrefixType = function () {
    var node = this.startNode();
    if (this.eat(tt.question)) {
      node.typeAnnotation = this.flowParsePrefixType();
      return this.finishNode(node, "NullableTypeAnnotation");
    } else {
      return this.flowParsePostfixType();
    }
  };

  pp.flowParseIntersectionType = function () {
    var node = this.startNode();
    var type = this.flowParsePrefixType();
    node.types = [type];
    while (this.eat(tt.bitwiseAND)) {
      node.types.push(this.flowParsePrefixType());
    }
    return node.types.length === 1 ? type : this.finishNode(node, "IntersectionTypeAnnotation");
  };

  pp.flowParseUnionType = function () {
    var node = this.startNode();
    var type = this.flowParseIntersectionType();
    node.types = [type];
    while (this.eat(tt.bitwiseOR)) {
      node.types.push(this.flowParseIntersectionType());
    }
    return node.types.length === 1 ? type : this.finishNode(node, "UnionTypeAnnotation");
  };
  
  pp.flowParseType = function () {
    var oldInType = this.inType; //this.state.inType;
    this.inType = true; //this.state.inType = true;
    var type = this.flowParseUnionType();
    this.inType = oldInType; // this.state.inType = oldInType;
    return type;
  };
  
  pp.flowParseTypeInitialiser = function (tok) {
    var oldInType = this.inType; //this.state.inType;
    this.inType = true; //this.state.inType = true; 
    this.expect(tok || tt.colon);
    var type = this.flowParseType();
    this.inType = oldInType; // this.state.inType = oldInType;
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
    
    // function foo<T>() {}
    instance.extend("parseFunctionParams", function (inner) {
      return function (node) {
        if (this.isRelational("<")) {
          node.typeParameters = this.flowParseTypeParameterDeclaration();
        }
        inner.call(this, node);
      };
    });
    
    // var foo: string = bar
    instance.extend("parseVarId", function (inner) {
      return function (decl) {
        inner.call(this, decl);
        if (match(this, tt.colon)) {
          decl.id.typeAnnotation = this.flowParseTypeAnnotation();
          this.finishNode(decl.id, decl.id.type);
        }
      };
    });

  }
  
  return acorn;
}