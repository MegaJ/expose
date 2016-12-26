const nodeVersionString = "v6.9.2"
const apiEntryPoints = 5;
const expose = require("../index.js");
const {stream, enumeralize, allKeysNested, allKeysArrays, allKeysFlat} = expose;
const {Transform} = require('stream');
const doNotMockUtil = require('util');

/** 
	using jasmine-node v1.14.3. I've noticed either bugs or my own mistakes writing tests:
	* jasmine-node doesn't correctly tell me the number of assertions that ran
	* it wrongly reasons about which test failed, however provides the correct line numbers
	* async testing issues

	* Since I'm heavily modifying properties of objects, the jasmine test suite can fail
	because it expects certain properties to be intact and tries calling them as functions
	such as hasOwnProperty and toString. I get around this by using .inspect(). JSON.stringify ignores too much data.
**/

// TODO:
//  * Test for different options passed into function
//  * consider regex feature to grab matching properties
//  * allow saving pairs for the methods that return arrays

// options:

// this.opt.exposeMethod = expose[methodName] || expose.allKeysFlat; // consider changing default to allKeysNested ////
// 	this.opt.objectMode = true; //options.objectMode = ('objectMode' in options) ? options.objectMode : true; //// No need to test for
// 	this.opt.keepValues = ('keepValues' in options) ? options.keepValues : false; //// TEST that it works with getters
// this.opt.regex

// test objs
function Parent() {}
Parent.prototype.name = 'Parent';

function Child() {}
Child.prototype = Object.create(Parent.prototype);
Child.prototype.constructor = Child;

const propsOfObject = allKeysFlat({});
const objPropLen = propsOfObject.length;

describe("expose", () => {

	let objWithSymbol = {};
	objWithSymbol[Symbol("a")] = "a";

	let objWithNonenum = {};
	Object.defineProperty(objWithNonenum, "prop", {
		value: "super-hidden",
		writable: false,
		enumerable: false
	});
	
	it("only documented methods from docs exist, otherwise change this testfile and docs accordingly", () => {
		expect(stream).toBeDefined();
		expect(enumeralize).toBeDefined();
		expect(allKeysNested).toBeDefined();
		expect(allKeysArrays).toBeDefined();
		expect(allKeysFlat).toBeDefined();

		var functionalities = 0;
		Object.getOwnPropertyNames(expose).forEach((functionality) => {
			functionalities++;
		});
		expect(functionalities).toBe(apiEntryPoints);
	});

	// async tests
	describe("stream options: ", () => {

		let throughStream = new Transform({objectMode: true});
		throughStream._transform = (obj, enc, cb) => {
			cb(null, obj);
		};
		let throughStream2 = new Transform({objectMode: true});
		throughStream2._transform = (obj, enc, cb) => {
			cb(null, obj);
		};
		var flag, exposedObj, count, exposePipe;
		const {stdout} = require('process'); // not used yet
		beforeEach(() => {
			spyOn(expose, 'allKeysFlat').andCallThrough();
			spyOn(expose, 'allKeysArrays').andCallThrough();
			spyOn(expose, 'allKeysNested').andCallThrough();
			spyOn(expose, 'enumeralize').andCallThrough();
			flag = false;
			exposedObj = {};
			count = 0;

			throughStream.write(objWithNonenum);
		});

		afterEach(() => {
			throughStream.unpipe(exposePipe);
		});

		const asyncCb = function (streamOptions, methodName) {
			//if (streamOptions.whatIsGoingOn) console.trace("Inside asyncCB");
			exposePipe = expose.stream(streamOptions);
			runs(() => {
				throughStream.pipe(exposePipe).on("data", (obj) => {
					exposedObj = obj;
					flag = true;
				});
			});

			waitsFor(() => { return flag; }, "The pipe was too slow", 100);

			// it's odd, in jasmine-node 1.14.3 you can get hanging issues on errors if this run isn't here. :/
			runs(() => {
				expect(expose[methodName]).toHaveBeenCalled();
				expect(doNotMockUtil.inspect(exposedObj))
					.toEqual(doNotMockUtil.inspect(expose[methodName](objWithNonenum, streamOptions)));
			})
		};
		
		it("has default allKeysFlat mode", asyncCb.bind(null, null, "allKeysFlat"));
		it("can explicitly be set to allKeysFlat mode", asyncCb.bind(null, {method: "allKeysFlat"}, "allKeysFlat"));
		it("defaults to allKeysFlat mode when an improper method name is passed to the stream", asyncCb.bind(null, {method: "ThisIsMyUltimateForm"}, "allKeysFlat"));
		it("can be in allKeysArrays mode", asyncCb.bind(null, {method: "allKeysArrays"}, "allKeysArrays"));
		it("can be in allKeysNested mode", asyncCb.bind(null, {method: "allKeysNested"}, "allKeysNested"));
		it("can be in enumeralize mode", asyncCb.bind(null, {method: "enumeralize"}, "enumeralize"))
		it("prints the objects to console when verbose is set truthy", () => {
			spyOn(console, 'log');
			//runs(() => { asyncCb.bind(null, {verbose: true}, "allKeysFlat")}); // hangs by doing this
			runs(asyncCb.bind(null, {verbose: true}, "allKeysFlat"));
			waitsFor(() => { return flag; }, "The pipe was too slow", 100);
			runs(() => { expect(console.log).toHaveBeenCalled(); });
		});
		it("does not print objects to console when verbose is falsy", () => {
			spyOn(console, 'log');
			runs(asyncCb.bind(null, {verbose: false}, "allKeysFlat"));
			waitsFor(() => { return flag; }, "The pipe was too slow", 100);
			runs(() => { expect(console.log).not.toHaveBeenCalled(); });
		});
		it("can use the object's .inspect() function", () => {
			let util = require('util');
			spyOn(util, 'inspect');
			
			runs(asyncCb.bind(null, {verbose: true, customInspect: true}, "allKeysFlat"));
			waitsFor(() => { return flag; }, "The pipe was too slow", 100);
			runs(() => { expect(util.inspect).toHaveBeenCalledWith(jasmine.any(Object), {customInspect: true}) });
		});
		it("can ignore the object's .inspect() function", () => {
			let util = require('util');
			spyOn(util, 'inspect');
			
			runs(asyncCb.bind(null, {verbose: true, customInspect: false}, "allKeysFlat"));
			waitsFor(() => { return flag; }, "The pipe was too slow", 100);
			runs(() => { expect(util.inspect).toHaveBeenCalledWith(jasmine.any(Object), {customInspect: false}) });
		});
		describe("allows values to be kept", () => {
			// spies are still active here
			it("for allKeysNested", () => {
				//spyOn(expose, "allKeysNested");
				runs(asyncCb.bind(null, {whatIsGoingOn: true, keepValues: true, customInspect: false, method: "allKeysNested"}, "allKeysNested"));
				//runs(asyncCb.bind(null, {method: "allKeysNested", keepValues: true}, "allKeysNested"));
				waitsFor(() => { return flag; }, "The pipe was too slow", 100);
				runs(() => {
					expect(expose.allKeysNested).toHaveBeenCalledWith(jasmine.any(Object), {
						keepSymbols: false,
						customInspect: false,
						keepValues: true,
						objectMode: true,
						exposeMethod: expose["allKeysNested"],
						verbose: false,
					})
				});
			});

			it("for allKeysArrays", () => {
				runs(asyncCb.bind(null, {keepValues: true, customInspect: false, method: "allKeysArrays"}, "allKeysArrays"));
				//runs(asyncCb.bind(null, {method: "allKeysArrays", keepValues: true}, "allKeysArrays"));
				waitsFor(() => { return flag; }, "The pipe was too slow", 100);
				runs(() => {
					expect(expose.allKeysArrays).toHaveBeenCalledWith(jasmine.any(Object), {
						keepSymbols: false,
						customInspect: false,
						keepValues: true,
						objectMode: true,
						exposeMethod: expose["allKeysArrays"],
						verbose: false,
					})
				});
			});
			
		})
		
	});

	describe("enumeralize", () => {
		let enumeralizedObj1 = enumeralize(objWithNonenum, {});
		let enumeralizedObj2 = enumeralize(objWithSymbol, {});

		it("ensures all its own properties are enumerable and makes symbols strings", () => {
			const e1Keys = Object.keys(enumeralizedObj1);
			var origEnumKeys = Object.keys(objWithNonenum);

			expect(e1Keys.length).toBeGreaterThan(origEnumKeys.length);
			expect(e1Keys.length).toBe(origEnumKeys.length + 1);

			const e2Keys = Object.keys(enumeralizedObj2);
			const symbolsArr = Object.getOwnPropertySymbols(objWithSymbol);
			const nonSymbolsArr = Object.getOwnPropertyNames(objWithSymbol);
			const combinedLength = symbolsArr.length + nonSymbolsArr.length

			//console.log(symbolsArr, " and ", nonSymbolsArr);
			expect(e2Keys.length).toBeGreaterThan(origEnumKeys.length);
			expect(e2Keys.length).toBe(combinedLength);
		});
		it("preserves a mirrored prototype chain", () => {
			let eobj = enumeralizedObj1;
			let oobj = objWithNonenum;
			let enumizedAncestorCount = 0;
			let origAncestorCount = 0;
			while(eobj || oobj) {
				//console.log(enumizedAncestorCount, " and ", origAncestorCount);
				eobj ? enumizedAncestorCount++ && (eobj = Object.getPrototypeOf(eobj)) : null;
				oobj ? origAncestorCount++ && (oobj = Object.getPrototypeOf(oobj)) : null;
//				console.log("eobj :", eobj, " and oobj: ", oobj);
			}

			///console.log(enumizedAncestorCount, " and ", origAncestorCount);
			expect(enumizedAncestorCount).toBe(origAncestorCount);
		});

		// this would fail if objWithNonenum had symbol keys, since I stringify all kys
		it("ensures matching properties with original object", () => {
			var enumeralizedObj = enumeralize(objWithNonenum);
						
			while(enumeralizedObj) {
				Object.keys(enumeralizedObj).forEach((key) => {
					expect(key in objWithNonenum).toBe(true);
				});
				enumeralizedObj = Object.getPrototypeOf(enumeralizedObj);
			}
		});
		it("filters on supplied regexes if any", () => {
			var filteredObj = enumeralize(objWithNonenum, {regexp: /pro/});
			expect(filteredObj.prop).toBeTruthy();

			filteredObj = enumeralize(objWithNonenum, {regexp: /__/});
			expect(filteredObj.prop).toBeUndefined();
		});
	});

	describe("allKeysNested", () => {

		it("exposes own symbols", () => {
			expect(true).toBe(true);
			const exposedObj = allKeysArrays(objWithSymbol);
			expect(exposedObj.length).toEqual(2);
			expect(exposedObj[0].length).toBe(1)
		});

		it("exposes ancestors' symbols", () => {
			const myChild = Object.create(objWithSymbol);
			const exposedObj = allKeysArrays(myChild);
			expect(exposedObj.length).toEqual(3);
			expect(exposedObj[0].length).toBe(0);
			expect(exposedObj[1].length).toBe(1);
		});

		it("exposes nonenumerables", () => {
			const exposedObj = allKeysArrays(objWithNonenum);
			expect(exposedObj[0].length).toEqual(1);
		});

		it("filters on supplied regexes", () => {
			var filteredObj = allKeysNested(objWithNonenum, {regexp: /pro/});
			expect(filteredObj.prop).toEqual(true);
			// hmm, should I erase the prototype chain? probably not...
			// expect(filteredObj.__proto__).toBeUndefined(); // fails

			filteredObj = allKeysNested(objWithNonenum, {regexp: /__/});
			expect(filteredObj.prop).toBeUndefined();
		});
	});

	describe("allKeysArrays", () => {
		it("should show make a new array for each existing parent", () => {
			expect(allKeysArrays({}).length).toBe(2);
			expect(allKeysArrays({a: 'a'}).length).toBe(2);
			expect(allKeysArrays(Child).length).toBe(3);
			expect(allKeysArrays(new Child()).length).toBe(4);
		});

		it("exposes own symbols", () => {
			const exposedObj = allKeysArrays(objWithSymbol);
			expect(exposedObj.length).toEqual(2);
			expect(exposedObj[0].length).toBe(1)
		});

		it("exposes ancestors' symbols", () => {
			const myChild = Object.create(objWithSymbol);
			const exposedObj = allKeysArrays(myChild);
			expect(exposedObj.length).toEqual(3);
			expect(exposedObj[0].length).toBe(0);
			expect(exposedObj[1].length).toBe(1);
		});

		it("exposes nonenumerables", () => {
			const exposedObj = allKeysArrays(objWithNonenum);
			expect(exposedObj[0].length).toEqual(1);
		});

		it("filters on supplied regexes if any", () => {
			var filteredObj = allKeysArrays(objWithNonenum, {regexp: /pro/});

			expect(filteredObj[0]).toContain("prop");

			filteredObj = allKeysArrays(objWithNonenum, {regexp: /__/});
			console.log("filteredObj: ", filteredObj);
			expect(filteredObj[0].length).toBe(0);
		});
	});
	
	const flatnessChecker = (key) => {
		expect(Object.prototype.toString(key) !== '[object Array]').toBe(true);
	}
	describe("allKeysFlat", () => {

		it("returns a flat array", () => {
			allKeysArrays(new Child()).forEach(flatnessChecker);
			allKeysArrays({}).forEach(flatnessChecker);
			allKeysArrays({a: 'a'}).forEach(flatnessChecker);
			allKeysArrays(Child).forEach(flatnessChecker);
		});

		it("gives duplicate keys if a descendent has same property name as ancestor", () => {
			const exposedObj = allKeysFlat({hasOwnProperty: "I'm a duplicate"});
			expect(exposedObj.length).toEqual(objPropLen + 1);
		});

		it("exposes symbols", () => {
			const exposedObj = allKeysFlat(objWithSymbol);
			expect(exposedObj.length).toEqual(objPropLen + 1);
		});

		it("exposes nonenumerables", () => {
			const exposedObj = allKeysFlat(objWithNonenum);
			expect(exposedObj.length).toEqual(objPropLen + 1);
		});

	});
});

describe("exposing expose", () => {
	
	const builtInObject = {
		hasOwnProperty: true,
		constructor: true,
		toString: true,
		toLocaleString: true,
		valueOf: true,
		isPrototypeOf: true,
		propertyIsEnumerable: true,
		__defineGetter__: true,
		__lookupGetter__: true,
		__defineSetter__: true,
		__lookupSetter__: true
	};

	it(`underlying object properties have not changed since I wrote this for ${nodeVersionString}`, () => {
		expect(doNotMockUtil.inspect(allKeysNested({}).__objParent))
			.toEqual(doNotMockUtil.inspect(builtInObject));
	});

	it ("Object.prototype is expose's only ancestor", () => {
		const exposedObj = allKeysNested(expose);
		expect(doNotMockUtil.inspect(exposedObj.__objParent))
			.toEqual(doNotMockUtil.inspect(builtInObject));
		expect(exposedObj.__objParent.__objParent).toBe(undefined);
	});
});

