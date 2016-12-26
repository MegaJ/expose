expose
=========

   ES 6 only.
   This module helps expose javascript properties of an object across its entire prototype chain. 

   Use cases:
   All symbols and nonenumerable/inherited properties become enumerable in the returned objects, so you don't have to roll out your own logic
   to expose everything.

   Perhaps useful when debugging, for quick lookups for object methods in a REPL, or reasoning about an object's inheritance history.
   Unlike util.inspect(), you get objects and arrays returned, not strings. This allows you to set up mocks for real objects.

   Not tested on browsers, but seems to work for me.

## Installation

    npm install https://github.com/MegaJ/expose --save-dev
  
## Easy usage

```javascript
const expose = require('expose');
const {allKeysNested} = expose;

const curiousObj = {a: 1, b: 2};
const exposedObj = allKeysNested(curiousObj, {keepValues: true});
console.log(exposedObj);
/**
{ a: 1,
  b: 2,
  __objParent: 
   { hasOwnProperty: [Function: hasOwnProperty],
     constructor: [Function: Object],
     toString: [Function: toString],
     toLocaleString: [Function: toLocaleString],
     valueOf: [Function: valueOf],
     isPrototypeOf: [Function: isPrototypeOf],
     propertyIsEnumerable: [Function: propertyIsEnumerable],
     __defineGetter__: [Function: __defineGetter__],
     __lookupGetter__: [Function: __lookupGetter__],
     __defineSetter__: [Function: __defineSetter__],
     __lookupSetter__: [Function: __lookupSetter__],
     __proto__: [Getter/Setter] } }
**/

// Or a little meta:
console.log(allKeysNested(expose, {keepvalues: true}));
/**
{ stream: [Function: stream],
  enumeralize: [Function: enumeralize],
  allKeysNested: [Function: allKeysNested],
  allKeysArrays: [Function: allKeysArrays],
  allKeysFlat: [Function: allKeysFlat],
  __objParent: 
   { hasOwnProperty: [Function: hasOwnProperty],
     constructor: [Function: Object],
     toString: [Function: toString],
     toLocaleString: [Function: toLocaleString],
     valueOf: [Function: valueOf],
     isPrototypeOf: [Function: isPrototypeOf],
     propertyIsEnumerable: [Function: propertyIsEnumerable],
     __defineGetter__: [Function: __defineGetter__],
     __lookupGetter__: [Function: __lookupGetter__],
     __defineSetter__: [Function: __defineSetter__],
     __lookupSetter__: [Function: __lookupSetter__],
     __proto__: [Getter/Setter] } }
**/


```
## API

#### stream
Make a stream object. You might also consider using a through2 instead to make a stream and use expose's methods inside through2's API.
	 
    const exposeStream = expose.stream({
        method: "allKeysArrays",
        keepValues: true
	});

#### enumeralize

allKeysNested: [Function: allKeysNested],
allKeysArrays: [Function: allKeysArrays],
allKeysFlat: [Function: allKeysFlat],


## Advanced Usage

```javascript
const expose = require('expose');
const {stream, enumeralize, allKeysNested, allKeysArrays, allKeysFlat} = expose;

// set up a stream to pipe into expose.stream
const {Transform} = require('stream');
let throughStream = new Transform({objectMode: true});
throughStream._transform = (obj, enc, cb) => { cb(null, obj) };

// create an expose transform stream
const exposeStream = stream({verbose: true, method: "allKeysNested"});

throughStream.write({})
throughStream.pipe(exposeStream);
/**
{ __objParent: 
   { hasOwnProperty: true,
     constructor: true,
     toString: true,
     toLocaleString: true,
     valueOf: true,
     isPrototypeOf: true,
     propertyIsEnumerable: true,
     __defineGetter__: true,
     __lookupGetter__: true,
     __defineSetter__: true,
     __lookupSetter__: true } }
**/
```

## Gotchas

### The "this"

  For all functions except `expose.enumeralize()`, the prototype chain isn't preserved, so references to `this.coolProperty` may not exist.
  You'll get errors thrown if that is the case.
  
### Accessors (getter/Setter and value/writable)

  Getters and setters, if they exist for a property get triggered when you access a property, and you may get errors thrown.
  This is a sub problem of the above.
  
  Here's an example of that:
  Sometimes an object may implement an `.inspect()` function. By default, console.logging will use this custom `.inspect()`.
  The `.inspect()` implementation might call internal properties that are getters:

    this.history[this.history.length - 1]; // gulp's vinyl-fs source code
  But depending on options passed to `expose`, the `this` may not conform correctly to the original object's structure. (like when using `expose.allKeysNested()`)
  Console.logging will lead to throwing errors in the object's `.inspect()`.
  
  Turn off the use of `.inspect()` when logging by doing something like this:
  
    const util = require('util');
    console.log(util.inspect({customInspect: false}));

### Prototypes of primitives

``` javascript
const mySym = Symbol("testSymbol");
const mySymPrototype = Object.getPrototypeOf(mySym);

mySymPrototype.isPrototypeOf(mySym); // false...
Symbol.prototype === mySymPrototype; // true....
```

This is because in ES6, .getPrototypeOf() under-the-hood coreces primitives to Object first. When expose gives you objects, it also coerces primitives to objects first, so just be aware of that.

``` javascript
mySymPrototype.isPrototypeOf(Object(mySym)); // true
```
### Not on npm

  I could.
  
## Tests

    npm test

## TODO

  * consider regex feature to grab matching properties -- on it
  * allow saving pairs for the methods that return arrays
  * write tests
  * learn semantic versioning
  * refactor propAssignerBase() so multiple functions can use it
  * rename functions
  * warn user when using allKeysArrays or allKeysFlat..they can only save keys OR values, but not both
  * strip 'Symbol' from .toString() on symbols.

## Release History

* 0.0.0 Haven't learned about semantic versioning yet.

## License

[BSD-2](https://opensource.org/licenses/BSD-2-Clause)