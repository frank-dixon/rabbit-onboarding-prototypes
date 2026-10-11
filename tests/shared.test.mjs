// Unit tests for the shared rules in assets/shared.js.
// Run with: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function loadProto() {
  const storage = new Map();
  const window = {
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
    },
    addEventListener() {},
  };
  const context = vm.createContext({
    window,
    navigator: {},
    document: { querySelector: () => null },
    console,
  });
  for (const file of ["assets/breeds.js", "assets/shared.js"]) {
    vm.runInContext(readFileSync(file, "utf8"), context, { filename: file });
  }
  return window.Proto;
}

// Objects made inside the vm context are not deep-equal to host objects,
// so compare plain JSON copies.
const plain = (value) => JSON.parse(JSON.stringify(value));

let P;
beforeEach(() => {
  P = loadProto();
});

function basics(overrides = {}) {
  return Object.assign(P.getDraft("a"), {
    name: "Hazel",
    sex: "doe",
    birthDate: "2024-05-01",
    color: "Black",
    status: "growing",
  }, overrides);
}

test("seeds a fake demo herd", () => {
  const data = P.load();
  assert.ok(data.rabbits.length >= 4);
  assert.ok(data.rabbits.every((rabbit) => rabbit.demo));
});

test("basics are required and the birth date cannot be in the future", () => {
  const empty = P.validate(P.getDraft("a"), ["name", "sex", "birthDate", "color"]);
  assert.deepEqual(plain(Object.keys(empty).sort()), ["birthDate", "color", "name", "sex"]);
  const future = P.validate(basics({ birthDate: "2999-01-01" }), ["birthDate"]);
  assert.match(future.birthDate, /^The birth date can't be in the future\. Please pick/);
  assert.deepEqual(plain(P.validate(basics(), ["name", "sex", "birthDate", "color", "status"])), {});
});

test("a purebred needs a breed from the cited list", () => {
  const draft = basics({ breedType: "purebred", purebred: "Not A Breed" });
  assert.ok(P.validate(draft, ["breed"]).purebred);
  draft.purebred = "Mini Californian";
  assert.deepEqual(plain(P.validate(draft, ["breed"])), {});
});

test("a cross needs two or more distinct breeds totalling 100", () => {
  const draft = basics({ breedType: "crossbred" });
  draft.cross = [{ breed: "Rex", percent: "60" }, { breed: "", percent: "" }];
  assert.match(P.validate(draft, ["breed"]).cross, /^A crossbred rabbit has at least two breeds\./);

  draft.cross = [{ breed: "Rex", percent: "60" }, { breed: "Dutch", percent: "30" }];
  assert.match(P.validate(draft, ["breed"]).cross, /^The shares need to add up to exactly 100%, and right now they add up to 90%\./);

  draft.cross = [{ breed: "Rex", percent: "50" }, { breed: "Rex", percent: "50" }];
  assert.ok(P.validate(draft, ["breed"])["cross.1.breed"]);

  draft.cross = [
    { breed: "Rex", percent: "50" },
    { breed: "Dutch", percent: "25" },
    { breed: "Thuringer", percent: "25" },
  ];
  assert.deepEqual(plain(P.validate(draft, ["breed"])), {});
  assert.equal(P.breedLine(draft), "Cross: 50% Rex, 25% Dutch, 25% Thuringer");
});

test("relatives need a relationship and one rabbit, with the right sex for dam and sire", () => {
  const draft = basics();
  draft.relatives = [{ relationship: "", ref: "", newName: "", newDetails: "" }];
  const errors = P.validate(draft, ["relatives"]);
  assert.ok(errors["relatives.0.relationship"]);
  assert.ok(errors["relatives.0.ref"]);

  draft.relatives = [{ relationship: "dam", ref: "h:2", newName: "", newDetails: "" }];
  assert.equal(
    P.validate(draft, ["relatives"])["relatives.0.ref"],
    "The dam has to be a doe. Bramble is a buck, so pick a doe here."
  );

  draft.relatives = [{ relationship: "sibling", ref: "h:1", newName: "Extra", newDetails: "" }];
  assert.match(P.validate(draft, ["relatives"])["relatives.0.newName"], /^Each place holds one rabbit\..*not both\.$/);
});

test("relatives can list only one dam and one sire", () => {
  const draft = basics();
  draft.relatives = [
    { relationship: "dam", ref: "h:1", newName: "", newDetails: "" },
    { relationship: "sire", ref: "h:2", newName: "", newDetails: "" },
    { relationship: "dam", ref: "h:3", newName: "", newDetails: "" },
    { relationship: "sire", ref: "h:4", newName: "", newDetails: "" },
  ];
  const errors = plain(P.validate(draft, ["relatives"]));
  assert.equal(errors["relatives.0.relationship"], undefined);
  assert.equal(errors["relatives.1.relationship"], undefined);
  assert.equal(
    errors["relatives.2.relationship"],
    "A rabbit can have only one dam, and Relative 1 is already listed as the dam. Choose a different relationship here."
  );
  assert.match(errors["relatives.3.relationship"], /^A rabbit can have only one sire, and Relative 2 is already listed as the sire\./);

  draft.relatives = draft.relatives.slice(0, 2);
  assert.deepEqual(plain(P.validate(draft, ["relatives"])), {});
});

test("pedigree places check the sex and can be validated one generation at a time", () => {
  const draft = basics();
  draft.pedigree = { s: { ref: "h:1" }, dd: { ref: "h:2" } };
  assert.equal(
    P.validate(draft, ["pedigree:1"])["pedigree.s.ref"],
    "The sire has to be a buck. Juniper is a doe, so pick a buck here."
  );
  assert.match(P.validate(draft, ["pedigree"])["pedigree.dd.ref"], /^The dam's dam has to be a doe\./);
  assert.equal(P.validate(draft, ["pedigree:1"])["pedigree.dd.ref"], undefined);
  assert.ok(P.validate(draft, ["pedigree"])["pedigree.dd.ref"]);
  assert.equal(P.PEDIGREE.length, 14);
  assert.equal(P.positionLabel("sd"), "Sire's dam");
});

test("finishing saves the rabbit, reuses outside entries, and clears the draft", () => {
  const draft = basics({ breedType: "purebred", purebred: "Holland Lop" });
  draft.relatives = [{ relationship: "sire", ref: "", newName: "Ridgeview Thistle", newDetails: "Demo. Holland Lop doe, tag RV-12" }];
  draft.pedigree = { d: { ref: "h:1" }, s: { newName: "Big Ben", newDetails: "" } };
  P.saveDraft("a", draft);
  const before = P.load().outside.length;

  const rabbit = P.finish("a", draft);

  const data = P.load();
  assert.equal(data.rabbits.at(-1).name, "Hazel");
  assert.equal(rabbit.breedLine, "Holland Lop");
  assert.equal(rabbit.relatives[0].ref, "o:51");
  assert.equal(data.outside.length, before + 1);
  assert.equal(P.refName(data, { ref: rabbit.pedigree.s }), "Big Ben");
  assert.equal(data.drafts.a, undefined);
});

test("dam and sire relatives prefill empty pedigree parents", () => {
  const draft = basics();
  draft.relatives = [{ relationship: "dam", ref: "h:1", newName: "", newDetails: "" }];
  P.prefillPedigree(draft);
  assert.equal(draft.pedigree.d.ref, "h:1");
});

test("drafts survive a reload of the store", () => {
  const draft = basics();
  P.saveDraft("b", draft);
  assert.equal(P.getDraft("b").name, "Hazel");
  P.reset();
  assert.equal(P.getDraft("b").name, "");
});
