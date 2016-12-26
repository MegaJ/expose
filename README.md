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

    npm install https://github.com/MegaJ/expose.git --save-dev
  
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
Make a stream object. 
``` javascript
    var exposeStream = expose.stream({
        method: "allKeysArrays",
        keepValues: true
	});
```
You might also consider using a through2 instead to make a stream and use expose's methods inside through2's API.
#### enumeralize(obj [, options])
If `obj` is a function, the output will not be invokable (because I use Object.create() in a loop). Will fix, but not yet.
Returns a copy of an object. Coerces symbols to strings by default (collisions possible). Preserves a mirrored prototype chain. Not exactly a deep copy(?).

```javascript
const {enumeralize} = require('expose');

var objWithInvisibles = {};
objWithInvisibles[Symbol.for("aSymbol")] = "symbol val"
Object.defineProperty(objWithInvisibles, "aNonenumerable", {
	value: "super-hidden",
	enumerable: false
});
console.log(objWithInvisibles); // {}

var enumeralizedObj = enumeralize(objWithInvisibles);
console.log(enumeralizedObj);

/** 
{ aNonenumerable: 'super-hidden',
  'Symbol(aSymbol)': 'symbol val' }
**/

```

#### allKeysNested(obj [, options])
See Easy Usage section for example format.

#### allKeysArrays(obj [, options])
Get all keys in this format:

    [
      [] // obj props
      [] // obj's parent's props
      [] // obj's parent's parent's props
    ...
    ]
No symbol coercion to strings. Doesn't keep values.
#### allKeysFlat(obj [, options])
Get all keys in this format:

    [...]
No symbol coercion to strings. Doesn't keep values.
#### The options object

```javascript
// not actual sourcecode
const defaultOptions = {
	// for stream()
	method: "allKeysFlat",
	objectMode: true,
	verbose: false,
	customInspect: false,
	// for all functions
	keepValues: false,
	keepSymbols: false,
	regexp: false
}
```
* `method`: String name of the expose method you wish to use within the stream. Untested what happens if you put in `"stream"`.
* `objectMode`: No need to pass in. Set to true internally regardless.
* `verbose`: stream will print out the exposed object to console. Any unsupported options will be printed via `console.warn()`.

* `customInspect`: pass in a truthy value if you prefer the customInspect of the object. (See gotchas if not using `expose.enumeralize()`)
* `keepValues`: keeps the values, otherwise you get `true` for the value
* `keepSymbols`: allow symbols to remain uncoerced to strings
* `regexp`: use a regex to only include properties whose `.toString()` match the regex.

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

  This is a subproblem of the `this`.
  Be aware of getters and setters. Expose methods return some type of "copy" of the object, so if you access a property that happens to be an accessor, and you may get errors thrown. Getters may be triggered when you `console.log` a returned expose object.
  
  Here's an example of that:
  Sometimes an object may implement an `.inspect()` function. By default, console.logging will use this custom `.inspect()`.
  The `.inspect()` implementation might call internal properties that are getters:

    this.history[this.history.length - 1]; // gulp's vinyl-fs source code
  But depending on options passed to `expose`, the `this` may not conform correctly to the original object's structure. (like when using `expose.allKeysNested()`)
  Console.logging will lead to throwing errors in the object's `.inspect()`.
  
  Turn off the use of `.inspect()` when logging by doing something like this:
  ```javascript
    const util = require('util');
	var curiousObj = /** your object here **/ // I should make a runnable example
	var exposedObj = expose.allKeysNested(curiousObj, {keepValues: true});
    console.log(util.inspect(expose.allKeysNested(exposedObj, {customInspect: false}));
  ```
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

  * Fix readme...
  * enumeralize doesn't work on functions?!
  * Rename this project since an npm module exists named 'expose'
  * Make expose loadable in browser
  * add readme example: consider regex feature to grab matching properties -- on it
  * allow saving pairs for the methods that return arrays / allow returning maps
  * learn semantic versioning
  * refactor propAssignerBase() so multiple functions can use it
  * rename functions
  * warn user when using allKeysArrays or allKeysFlat..they can only save keys OR values, but not both
  * strip 'Symbol' from .toString() on symbols.
  * Decide when to use Reflect.ownKeys() when refactoring, which gets all property strings and property symbols
  * warn people if they use options that a function doesn't use (Symbols are always visible)
  * option to keep nonenumeral properties to be nonenumerable
  * allKeysArrays / allKeysFlat should use keepValues option

## Release History

* 0.0.0 Haven't learned about semantic versioning yet.

## License

[BSD-2](https://opensource.org/licenses/BSD-2-Clause)
