/*
 * Shared pieces for the three add-a-rabbit prototypes.
 *
 * Everything is saved in this browser's localStorage under one key. There
 * is no server. The herd starts with fake demo rabbits, and "Reset demo
 * data" on the index page puts them back.
 *
 * The flows share one draft shape, one set of field renderers, and one
 * validator, so A, B, and C differ only in how they lay the steps out.
 * Inputs carry data-bind="path" (for example "cross.1.percent"), and a
 * single delegated listener copies their values into the draft and saves
 * it, so progress survives a refresh.
 */
(function () {
  "use strict";

  const STORE_KEY = "rabbit-onboarding-prototypes:v1";
  const BREEDS = window.RabbitBreeds;
  const BREED_NAMES = new Set(BREEDS.arba.concat(BREEDS.other));

  const SEXES = [["doe", "Doe", "Female"], ["buck", "Buck", "Male"]];
  const STATUSES = [
    ["breeding", "Breeding", "Kept for breeding."],
    ["growing", "Growing out", "A young rabbit you're raising before deciding whether to keep it."],
    ["sold", "Sold", "Sold to someone else."],
    ["culled", "Culled", "Removed from the herd."],
  ];
  const BREED_TYPES = [
    ["purebred", "Purebred", "All one breed."],
    ["crossbred", "Crossbred", "A mix of two or more breeds, each with a share in percent."],
  ];
  const RELATIONSHIPS = [
    ["dam", "Dam (mother)"],
    ["sire", "Sire (father)"],
    ["sibling", "Full sibling (same dam and sire)"],
    ["half_sibling", "Half sibling (one parent in common)"],
    ["offspring", "Offspring (a kit or grown young)"],
    ["granddam", "Granddam (grandmother)"],
    ["grandsire", "Grandsire (grandfather)"],
    ["grandchild", "Grandchild"],
    ["aunt_uncle", "Aunt or uncle"],
    ["niece_nephew", "Niece or nephew"],
    ["cousin", "Cousin"],
    ["other", "Other relative"],
  ];

  /* The steps every prototype walks through, in order. */
  const STEPS = [
    { id: "basics", title: "Basics", keys: ["name", "sex", "birthDate", "color", "status"] },
    { id: "breed", title: "Breed", keys: ["breedType", "breed"] },
    { id: "relatives", title: "Relatives", keys: ["relatives"] },
    { id: "pedigree", title: "Pedigree", keys: ["pedigree"] },
    { id: "review", title: "Review", keys: [] },
  ];

  /* Pedigree positions are paths: s is the sire, d the dam, sd the sire's
   * dam. Three generations give 2 + 4 + 8 = 14 positions. */
  const GENERATIONS = 3;
  const PEDIGREE = (function () {
    const all = [];
    let current = [""];
    for (let g = 0; g < GENERATIONS; g += 1) {
      current = current.flatMap(function (path) {
        return [path + "s", path + "d"];
      });
      all.push.apply(all, current);
    }
    return all;
  })();
  const GENERATION_NAMES = ["Parents", "Grandparents", "Great-grandparents"];

  function positionLabel(position) {
    const words = position.split("").map(function (step) {
      return step === "s" ? "sire" : "dam";
    });
    const text = words.join("'s ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function expectedSex(position) {
    return position.endsWith("s") ? "buck" : "doe";
  }

  /* ---------- Store ---------- */

  function seedData() {
    return {
      version: 1,
      nextId: 100,
      rabbits: [
        demoRabbit(1, "Juniper", "doe", "Broken black", "2023-04-12", "breeding", "Holland Lop"),
        demoRabbit(2, "Bramble", "buck", "Chestnut agouti", "2022-09-30", "breeding", "Holland Lop"),
        demoRabbit(3, "Maple", "doe", "Red", "2023-06-02", "breeding", "New Zealand"),
        demoRabbit(4, "Duke", "buck", "Black", "2021-11-18", "breeding", "Silver Fox"),
        demoRabbit(5, "Clover", "doe", "Blue", "2024-02-20", "growing", "Cross: 50% Rex, 50% Mini Rex"),
        demoRabbit(6, "Pepper", "buck", "Broken chocolate", "2024-03-08", "growing", "Mini Lop"),
      ],
      outside: [
        { id: 51, name: "Ridgeview Thistle", details: "Demo. Holland Lop doe, tag RV-12" },
        { id: 52, name: "Oak Hollow Major", details: "Demo. Holland Lop buck" },
        { id: 53, name: "Sunny Acres Ruby", details: "Demo. New Zealand doe" },
      ],
      drafts: {},
    };
  }

  function demoRabbit(id, name, sex, color, birthDate, status, breedLine) {
    return {
      id: id,
      demo: true,
      name: name,
      sex: sex,
      color: color,
      birthDate: birthDate,
      status: status,
      breedLine: breedLine,
      relatives: [],
      pedigree: {},
    };
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.version === 1) {
          return data;
        }
      }
    } catch (error) {
      /* Fall through to fresh demo data. */
    }
    const fresh = seedData();
    save(fresh);
    return fresh;
  }

  function save(data) {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }

  function reset() {
    const fresh = seedData();
    save(fresh);
    return fresh;
  }

  function emptyDraft() {
    return {
      name: "",
      sex: "",
      birthDate: "",
      color: "",
      status: "growing",
      breedType: "",
      purebred: "",
      cross: [{ breed: "", percent: "" }, { breed: "", percent: "" }],
      relatives: [],
      pedigree: {},
      step: 0,
      unlocked: 0,
      updatedAt: null,
    };
  }

  function getDraft(flow) {
    const data = load();
    return Object.assign(emptyDraft(), data.drafts[flow] || {});
  }

  function saveDraft(flow, draft) {
    const data = load();
    draft.updatedAt = new Date().toISOString();
    data.drafts[flow] = draft;
    save(data);
  }

  function clearDraft(flow) {
    const data = load();
    delete data.drafts[flow];
    save(data);
  }

  /* "h:3" is herd rabbit 3, "o:51" is outside rabbit 51. */
  function resolveRef(data, ref) {
    if (!ref) {
      return null;
    }
    const kind = ref.slice(0, 1);
    const id = Number(ref.slice(2));
    const list = kind === "h" ? data.rabbits : data.outside;
    const item = list.find(function (entry) {
      return entry.id === id;
    });
    return item ? { kind: kind, item: item } : null;
  }

  function refName(data, slot) {
    if (!slot) {
      return "";
    }
    if (slot.newName && slot.newName.trim()) {
      const details = (slot.newDetails || "").trim();
      return details ? slot.newName.trim() + " (" + details + ")" : slot.newName.trim();
    }
    const found = resolveRef(data, slot.ref);
    if (!found) {
      return "";
    }
    if (found.kind === "o" && found.item.details) {
      return found.item.name + " (" + found.item.details + ")";
    }
    return found.item.name + (found.kind === "h" ? " (herd)" : "");
  }

  function slotFilled(slot) {
    return Boolean(slot && (slot.ref || (slot.newName && slot.newName.trim())));
  }

  /* ---------- Validation ---------- */

  function today() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  }

  function crossTotal(draft) {
    return draft.cross.reduce(function (sum, row) {
      const value = parseInt(row.percent, 10);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }

  function breedLine(draft) {
    if (draft.breedType === "purebred") {
      return draft.purebred;
    }
    const rows = draft.cross
      .filter(function (row) {
        return row.breed && row.percent;
      })
      .slice()
      .sort(function (a, b) {
        return Number(b.percent) - Number(a.percent);
      });
    return "Cross: " + rows.map(function (row) {
      return row.percent + "% " + row.breed;
    }).join(", ");
  }

  /* Check a slot that names a herd rabbit, an outside rabbit, or a new
   * outside rabbit. sex, when given, is the sex the slot needs, and role
   * names the place in words ("dam", "sire's dam") for the message.
   * Messages state the rule first, then what to do. */
  function checkSlot(data, slot, sex, errors, key, role) {
    const hasNew = Boolean(slot.newName && slot.newName.trim());
    if (slot.ref && hasNew) {
      errors[key + ".newName"] = "Each place holds one rabbit. Choose one from the list or add an outside rabbit, but not both.";
      return;
    }
    if (!hasNew && (slot.newDetails || "").trim()) {
      errors[key + ".newName"] = "An outside rabbit needs a name. Add a name, or clear the details.";
      return;
    }
    if (slot.ref) {
      const found = resolveRef(data, slot.ref);
      if (!found) {
        errors[key + ".ref"] = "That rabbit is no longer in your list. Please choose again.";
      } else if (sex && found.kind === "h" && found.item.sex !== sex) {
        errors[key + ".ref"] = "The " + role + " has to be a " + sex + ". " + found.item.name +
          " is a " + found.item.sex + ", so pick a " + sex + " here.";
      }
    }
  }

  /* keys are field names from STEPS, or "pedigree:2" for one generation.
   * Returns { errorKey: message }. Error keys match data-bind paths. */
  function validate(draft, keys) {
    const data = load();
    const errors = {};
    keys.forEach(function (key) {
      if (key === "name" && !draft.name.trim()) {
        errors.name = "Each rabbit needs a name or an ear tag. Please add one.";
      }
      if (key === "sex" && !["doe", "buck"].includes(draft.sex)) {
        errors.sex = "Each rabbit is recorded as a doe or a buck. Please choose one.";
      }
      if (key === "birthDate") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate)) {
          errors.birthDate = "A birth date is required. Please pick one from the calendar.";
        } else if (draft.birthDate > today()) {
          errors.birthDate = "The birth date can't be in the future. Please pick today or an earlier date.";
        }
      }
      if (key === "color" && !draft.color.trim()) {
        errors.color = "A coat color helps tell rabbits apart, so it's required. Please describe the color.";
      }
      if (key === "status" && !STATUSES.some(function (s) { return s[0] === draft.status; })) {
        errors.status = "Each rabbit needs a status. Please choose one.";
      }
      if (key === "breedType" && !["purebred", "crossbred"].includes(draft.breedType)) {
        errors.breedType = "Each rabbit is either purebred or crossbred. Please choose one.";
      }
      if (key === "breed") {
        validateBreed(draft, errors);
      }
      if (key === "relatives") {
        // A rabbit has one dam and one sire, so each can be listed once.
        const parentSeen = {};
        draft.relatives.forEach(function (row, index) {
          const base = "relatives." + index;
          if (!row.relationship) {
            errors[base + ".relationship"] = "Each relative needs a relationship. Please choose how this rabbit is related.";
          } else if (row.relationship === "dam" || row.relationship === "sire") {
            if (parentSeen[row.relationship]) {
              errors[base + ".relationship"] = "A rabbit can have only one " + row.relationship +
                ", and Relative " + parentSeen[row.relationship] + " is already listed as the " +
                row.relationship + ". Choose a different relationship here.";
            } else {
              parentSeen[row.relationship] = index + 1;
            }
          }
          if (!slotFilled(row)) {
            errors[base + ".ref"] = "Each relative needs a rabbit. Choose one from the list or add an outside rabbit.";
          } else {
            const sex = row.relationship === "dam" ? "doe" : row.relationship === "sire" ? "buck" : "";
            checkSlot(data, row, sex, errors, base, row.relationship);
          }
        });
      }
      if (key.indexOf("pedigree") === 0) {
        const generation = key.indexOf(":") > 0 ? Number(key.split(":")[1]) : 0;
        PEDIGREE.forEach(function (position) {
          if (generation && position.length !== generation) {
            return;
          }
          const slot = draft.pedigree[position];
          if (slot) {
            checkSlot(data, slot, expectedSex(position), errors, "pedigree." + position, positionLabel(position).toLowerCase());
          }
        });
      }
    });
    return errors;
  }

  function validateBreed(draft, errors) {
    if (draft.breedType === "purebred") {
      if (!BREED_NAMES.has(draft.purebred)) {
        errors.purebred = "A purebred rabbit needs a breed from the list. Please choose one.";
      }
      return;
    }
    if (draft.breedType !== "crossbred") {
      errors.breedType = "The breed choices depend on whether the rabbit is purebred or crossbred. Please choose that first.";
      return;
    }
    const seen = new Set();
    let used = 0;
    draft.cross.forEach(function (row, index) {
      const base = "cross." + index;
      const empty = !row.breed && row.percent === "";
      if (empty) {
        return;
      }
      used += 1;
      if (!BREED_NAMES.has(row.breed)) {
        errors[base + ".breed"] = "Each row in the mix needs a breed. Please choose one, or clear the share.";
      } else if (seen.has(row.breed)) {
        errors[base + ".breed"] = "Each breed can be listed only once in a mix. Please choose a different breed, or combine the shares.";
      }
      seen.add(row.breed);
      const value = Number(row.percent);
      if (!Number.isInteger(value) || value < 1 || value > 99) {
        errors[base + ".percent"] = "Each share is a whole number from 1 to 99. Please adjust this share.";
      }
    });
    if (used < 2) {
      errors.cross = "A crossbred rabbit has at least two breeds. Please add another breed to the mix.";
    } else if (crossTotal(draft) !== 100) {
      errors.cross = "The shares need to add up to exactly 100%, and right now they add up to " + crossTotal(draft) + "%. Please adjust the shares.";
    }
  }

  /* ---------- Saving a finished rabbit ---------- */

  function finish(flow, draft) {
    const data = load();
    const outsideFor = function (slot) {
      if (slot.ref) {
        return slot.ref;
      }
      const name = slot.newName.trim();
      const details = (slot.newDetails || "").trim();
      const existing = data.outside.find(function (entry) {
        return entry.name.toLowerCase() === name.toLowerCase() &&
          (entry.details || "").toLowerCase() === details.toLowerCase();
      });
      if (existing) {
        return "o:" + existing.id;
      }
      data.nextId += 1;
      data.outside.push({ id: data.nextId, name: name, details: details });
      return "o:" + data.nextId;
    };
    const pedigree = {};
    PEDIGREE.forEach(function (position) {
      if (slotFilled(draft.pedigree[position])) {
        pedigree[position] = outsideFor(draft.pedigree[position]);
      }
    });
    const relatives = draft.relatives.filter(slotFilled).map(function (row) {
      return { relationship: row.relationship, ref: outsideFor(row) };
    });
    data.nextId += 1;
    const rabbit = {
      id: data.nextId,
      name: draft.name.trim(),
      sex: draft.sex,
      birthDate: draft.birthDate,
      color: draft.color.trim(),
      status: draft.status,
      breedType: draft.breedType,
      breedLine: breedLine(draft),
      cross: draft.breedType === "crossbred"
        ? draft.cross.filter(function (row) { return row.breed; }).map(function (row) {
          return { breed: row.breed, percent: Number(row.percent) };
        })
        : [],
      relatives: relatives,
      pedigree: pedigree,
      createdWith: flow,
    };
    data.rabbits.push(rabbit);
    delete data.drafts[flow];
    save(data);
    return rabbit;
  }

  /* Copy a dam or sire relative into an empty pedigree parent place. */
  function prefillPedigree(draft) {
    draft.relatives.forEach(function (row) {
      const position = row.relationship === "sire" ? "s" : row.relationship === "dam" ? "d" : "";
      if (position && slotFilled(row) && !slotFilled(draft.pedigree[position])) {
        draft.pedigree[position] = { ref: row.ref || "", newName: row.newName || "", newDetails: row.newDetails || "" };
      }
    });
  }

  /* ---------- Markup ---------- */

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function idFor(path) {
    return "f-" + path.replace(/[.:]/g, "-");
  }

  const CONTROL = "mt-1 block w-full rounded border border-neutral-400 bg-white px-3 py-2 text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900";
  const CONTROL_LARGE = "mt-2 block w-full rounded-lg border border-neutral-400 bg-white px-4 py-4 text-lg text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900";
  const LABEL = "block text-sm font-medium text-neutral-800";
  const LABEL_LARGE = "block text-lg font-semibold text-neutral-900";
  const BUTTON_SECONDARY = "inline-flex min-h-11 items-center rounded border border-neutral-500 bg-white px-4 py-2 font-medium text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900";

  function errorSlot(path) {
    return '<p class="mt-1 text-sm font-medium text-red-800" id="' + idFor(path) + '-error" data-error-for="' + esc(path) + '" hidden></p>';
  }

  function described(path, help) {
    const ids = [idFor(path) + "-error"];
    if (help) {
      ids.unshift(idFor(path) + "-help");
    }
    return ' aria-describedby="' + ids.join(" ") + '"';
  }

  function textField(path, label, value, opts) {
    const big = opts.large;
    return '<div>' +
      '<label class="' + (opts.quiet ? "sr-only" : big ? LABEL_LARGE : LABEL) + '" for="' + idFor(path) + '">' + esc(label) + "</label>" +
      (opts.help ? '<p class="mt-1 text-sm text-neutral-600" id="' + idFor(path) + '-help">' + esc(opts.help) + "</p>" : "") +
      '<input class="' + (big ? CONTROL_LARGE : CONTROL) + '" id="' + idFor(path) + '" data-bind="' + esc(path) + '"' +
      ' type="' + (opts.type || "text") + '" value="' + esc(value) + '"' +
      (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : ' autocomplete="off"') +
      (opts.max ? ' max="' + opts.max + '"' : "") +
      (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : "") +
      described(path, opts.help) + ">" +
      errorSlot(path) +
      "</div>";
  }

  function selectField(path, label, value, options, opts) {
    const big = opts.large;
    const items = options.map(function (option) {
      if (option.group) {
        return '<optgroup label="' + esc(option.group) + '">' + option.items.map(function (item) {
          return '<option value="' + esc(item[0]) + '"' + (item[0] === value ? " selected" : "") + ">" + esc(item[1]) + "</option>";
        }).join("") + "</optgroup>";
      }
      return '<option value="' + esc(option[0]) + '"' + (option[0] === value ? " selected" : "") + ">" + esc(option[1]) + "</option>";
    }).join("");
    return '<div>' +
      '<label class="' + (opts.labelClass || (big ? LABEL_LARGE : LABEL)) + '" for="' + idFor(path) + '">' + esc(label) + "</label>" +
      (opts.help ? '<p class="mt-1 text-sm text-neutral-600" id="' + idFor(path) + '-help">' + opts.help + "</p>" : "") +
      '<select class="' + (big ? CONTROL_LARGE : CONTROL) + '" id="' + idFor(path) + '" data-bind="' + esc(path) + '"' + described(path, opts.help) + ">" +
      '<option value="">' + esc(opts.placeholder || "Choose…") + "</option>" + items +
      "</select>" + errorSlot(path) + "</div>";
  }

  /* Radio choices as tiles. Large tiles are the phone-friendly version. */
  function choiceField(path, legend, value, choices, opts) {
    const big = opts.large;
    const tiles = choices.map(function (choice, index) {
      const id = idFor(path) + "-" + index;
      return '<label for="' + id + '" class="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-400 bg-white has-checked:border-neutral-900 has-checked:bg-neutral-100 has-focus-visible:ring-2 has-focus-visible:ring-neutral-900 ' +
        (big ? "min-h-16 px-4 py-4 text-lg" : "min-h-11 px-3 py-2") + '">' +
        '<input class="mt-1 h-5 w-5 accent-neutral-900" type="radio" id="' + id + '" name="' + idFor(path) + '" data-bind="' + esc(path) + '" value="' + esc(choice[0]) + '"' +
        (choice[0] === value ? " checked" : "") + described(path) + ">" +
        '<span><span class="block font-semibold">' + esc(choice[1]) + "</span>" +
        (choice[2] ? '<span class="block text-sm text-neutral-600">' + esc(choice[2]) + "</span>" : "") +
        "</span></label>";
    }).join("");
    return '<fieldset id="' + idFor(path) + '">' +
      '<legend class="' + (opts.quiet ? "sr-only" : big ? LABEL_LARGE : LABEL) + '">' + esc(legend) + "</legend>" +
      '<div class="mt-2 grid gap-2 ' + (choices.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2") + '">' + tiles + "</div>" +
      errorSlot(path) + "</fieldset>";
  }

  function breedOptions() {
    return [
      { group: "ARBA recognized (" + BREEDS.arba.length + ")", items: BREEDS.arba.map(function (name) { return [name, name]; }) },
      { group: "Other recognized breeds (" + BREEDS.other.length + ")", items: BREEDS.other.map(function (name) { return [name, name]; }) },
    ];
  }

  function breedSourceNote() {
    return "The breed list comes from the " + BREEDS.sources.map(function (source) {
      return '<a class="underline" href="' + source.url + '" target="_blank" rel="noopener">' + esc(source.label) + "</a>";
    }).join(" and ") + ".";
  }

  /* A slot names a herd rabbit, a saved outside rabbit, or a new one. */
  function slotFields(path, label, slot, opts) {
    const data = load();
    const sex = opts.sex;
    const herd = data.rabbits.filter(function (rabbit) {
      return !sex || rabbit.sex === sex;
    }).map(function (rabbit) {
      return ["h:" + rabbit.id, rabbit.name + " · " + (rabbit.sex === "doe" ? "Doe" : "Buck") + " · " + rabbit.breedLine];
    });
    const outside = data.outside.map(function (entry) {
      return ["o:" + entry.id, entry.name + (entry.details ? " · " + entry.details : "")];
    });
    const groups = [];
    if (herd.length) {
      groups.push({ group: sex ? "In your herd (" + (sex === "doe" ? "does" : "bucks") + ")" : "In your herd", items: herd });
    }
    if (outside.length) {
      groups.push({ group: "Outside rabbits you've added before", items: outside });
    }
    const big = opts.large;
    return '<div class="space-y-3">' +
      selectField(path + ".ref", label, slot.ref || "", groups, {
        large: big,
        placeholder: "Choose a rabbit…",
        labelClass: opts.labelClass,
      }) +
      // The new-rabbit fields sit in a native disclosure so a pedigree of
      // 14 places stays readable. It opens by itself when it holds a name.
      '<details class="rounded border border-dashed border-neutral-300 px-3 py-2"' + (slot.newName || slot.newDetails ? " open" : "") + ">" +
      '<summary class="cursor-pointer text-sm font-medium text-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900">Not listed? Add an outside rabbit</summary>' +
      '<div class="mt-2 space-y-3">' +
      textField(path + ".newName", "Outside rabbit's name", slot.newName || "", { large: false }) +
      textField(path + ".newDetails", "Details (optional)", slot.newDetails || "", {
        large: false,
        help: "Anything that helps identify it, like an ear tag, registration number, breeder, or color.",
      }) +
      "</div></details></div>";
  }

  /* Render the markup for one field key. opts.large gives bigger targets;
   * opts.quiet hides a simple field's label visually when a question
   * heading already says it (screen readers still hear the label);
   * opts.generations limits the pedigree to some generations. */
  function renderField(key, draft, opts) {
    opts = opts || {};
    const big = opts.large;
    switch (key) {
      case "name":
        return textField("name", "Name or ear tag", draft.name, { large: big, quiet: opts.quiet });
      case "sex":
        return choiceField("sex", "Sex", draft.sex, SEXES, { large: big, quiet: opts.quiet });
      case "birthDate":
        return textField("birthDate", "Birth date", draft.birthDate, {
          large: big, quiet: opts.quiet, type: "date", max: today(),
          help: "Pick the date from the calendar. If you only know the month, choose the 1st.",
        });
      case "color":
        return textField("color", "Color", draft.color, { large: big, quiet: opts.quiet, help: "Describe the coat, for example broken black or chestnut agouti." });
      case "status":
        return choiceField("status", "Status", draft.status, STATUSES, { large: big, quiet: opts.quiet });
      case "breedType":
        return choiceField("breedType", "Breed type", draft.breedType, BREED_TYPES, { large: big, quiet: opts.quiet });
      case "breed":
        return renderBreed(draft, opts);
      case "relatives":
        return renderRelatives(draft, opts);
      case "pedigree":
        return renderPedigree(draft, opts);
      default:
        return "";
    }
  }

  function renderBreed(draft, opts) {
    const big = opts.large;
    const rows = draft.cross.map(function (row, index) {
      const base = "cross." + index;
      return '<li class="grid grid-cols-[1fr_6rem] items-end gap-2 sm:grid-cols-[1fr_7rem_auto]">' +
        selectField(base + ".breed", "Breed " + (index + 1), row.breed, breedOptions(), { large: false, placeholder: "Choose a breed…" }) +
        textField(base + ".percent", "Share (%)", row.percent, { type: "number", inputmode: "numeric" }) +
        (draft.cross.length > 2
          ? '<button type="button" class="' + BUTTON_SECONDARY + ' col-span-2 justify-center sm:col-span-1 sm:mb-6" data-action="remove-cross" data-index="' + index + '">Remove<span class="sr-only"> breed ' + (index + 1) + "</span></button>"
          : "") +
        "</li>";
    }).join("");
    const total = crossTotal(draft);
    return '<div class="space-y-4">' +
      '<p class="text-sm text-neutral-700" data-breed-hint' + (draft.breedType ? " hidden" : "") + ">Choose purebred or crossbred above, and the breed choices will appear here.</p>" +
      '<div data-breed-section="purebred"' + (draft.breedType === "purebred" ? "" : " hidden") + ">" +
      selectField("purebred", "Breed", draft.purebred, breedOptions(), { large: big, help: breedSourceNote(), placeholder: "Choose a breed…" }) +
      "</div>" +
      '<div data-breed-section="crossbred"' + (draft.breedType === "crossbred" ? "" : " hidden") + ">" +
      '<fieldset id="' + idFor("cross") + '"><legend class="' + (big ? LABEL_LARGE : LABEL) + '">Breeds in the mix</legend>' +
      '<p class="mt-1 text-sm text-neutral-600">List each breed and its share. The shares need to add up to 100%. For example, a rabbit with a Rex sire and a Dutch dam is 50% Rex and 50% Dutch. ' + breedSourceNote() + "</p>" +
      '<ul class="mt-3 space-y-3">' + rows + "</ul>" +
      '<div class="mt-3 flex flex-wrap items-center justify-between gap-3">' +
      '<button type="button" class="' + BUTTON_SECONDARY + '" data-action="add-cross">Add another breed</button>' +
      '<p class="rounded px-3 py-2 text-sm font-semibold ' + totalClass(total) + '" role="status" aria-live="polite" data-cross-total>' + totalText(total) + "</p>" +
      "</div>" + errorSlot("cross") + "</fieldset></div></div>";
  }

  function totalText(total) {
    if (total === 100) {
      return "Total: 100%. The mix adds up.";
    }
    if (total < 100) {
      return "Total so far: " + total + "%. Add " + (100 - total) + "% more to reach 100%.";
    }
    return "Total so far: " + total + "%. That's " + (total - 100) + "% over, so lower a share.";
  }

  function totalClass(total) {
    if (total === 100) {
      return "bg-green-100 text-green-900";
    }
    if (total > 100) {
      return "bg-red-100 text-red-900";
    }
    return "bg-neutral-100 text-neutral-800";
  }

  /* Relationship choices for one relatives row. A rabbit has one dam and
   * one sire, so once a row takes Dam or Sire the other rows stop offering
   * it. The row's own current choice always stays, so an older draft with
   * two dams still shows what it holds, and the checker flags it. */
  function relationshipChoices(draft, index) {
    const takenBy = {};
    draft.relatives.forEach(function (row, rowIndex) {
      if ((row.relationship === "dam" || row.relationship === "sire") && takenBy[row.relationship] === undefined) {
        takenBy[row.relationship] = rowIndex;
      }
    });
    const own = (draft.relatives[index] || {}).relationship;
    return RELATIONSHIPS.filter(function (choice) {
      const owner = takenBy[choice[0]];
      return owner === undefined || owner === index || choice[0] === own;
    });
  }

  function renderRelatives(draft, opts) {
    const big = opts.large;
    const rows = draft.relatives.map(function (row, index) {
      const base = "relatives." + index;
      return '<li class="space-y-3 rounded-lg border border-neutral-300 bg-white p-3">' +
        '<div class="flex items-center justify-between gap-2"><h3 class="font-semibold">Relative ' + (index + 1) + "</h3>" +
        '<button type="button" class="' + BUTTON_SECONDARY + '" data-action="remove-relative" data-index="' + index + '">Remove<span class="sr-only"> relative ' + (index + 1) + "</span></button></div>" +
        selectField(base + ".relationship", "Relationship", row.relationship, relationshipChoices(draft, index), {
          large: big,
          placeholder: "Choose a relationship…",
          help: "Dam means the mother and sire means the father. Each can be listed once.",
        }) +
        slotFields(base, "Rabbit", row, { large: big }) +
        "</li>";
    }).join("");
    return '<div class="space-y-3">' +
      '<p class="text-sm text-neutral-700">This step is optional. Add any relatives you know, whether they\'re in your herd or outside rabbits from another breeder.</p>' +
      (rows ? '<ul class="space-y-3">' + rows + "</ul>" : '<p class="rounded border border-dashed border-neutral-400 px-3 py-4 text-sm text-neutral-600">No relatives added yet. You can add some now or skip this step.</p>') +
      '<button type="button" class="' + BUTTON_SECONDARY + (big ? " min-h-14 w-full justify-center text-lg" : "") + '" data-action="add-relative">Add a relative</button>' +
      "</div>";
  }

  function renderPedigree(draft, opts) {
    const generations = opts.generations || [1, 2, 3];
    const columns = generations.map(function (generation) {
      const places = PEDIGREE.filter(function (position) {
        return position.length === generation;
      }).map(function (position) {
        const slot = draft.pedigree[position] || {};
        const sex = expectedSex(position);
        return '<div class="rounded-lg border bg-white p-3 ' + (sex === "buck" ? "border-sky-300" : "border-rose-300") + '">' +
          slotFields("pedigree." + position, positionLabel(position), slot, {
            sex: sex,
            labelClass: "block text-sm font-semibold text-neutral-900",
          }) + "</div>";
      }).join("");
      return '<section class="space-y-3" aria-labelledby="gen-' + generation + '">' +
        '<h3 class="font-semibold" id="gen-' + generation + '">' + GENERATION_NAMES[generation - 1] + "</h3>" +
        places + "</section>";
    }).join("");
    const layout = generations.length > 1 ? "grid gap-4 lg:grid-cols-3" : "grid gap-4";
    return '<div class="space-y-3">' +
      '<p class="text-sm text-neutral-700">Optional. Sire places need a buck and dam places a doe. Blue cards are sires, pink cards are dams.</p>' +
      '<div class="' + layout + '">' + columns + "</div></div>";
  }

  /* opts.pedigree === false leaves the pedigree out, for a flow that does
   * not ask for one. */
  function renderReview(draft, opts) {
    opts = opts || {};
    const data = load();
    const rows = [
      ["Name", draft.name],
      ["Sex", draft.sex === "doe" ? "Doe" : draft.sex === "buck" ? "Buck" : ""],
      ["Birth date", draft.birthDate],
      ["Color", draft.color],
      ["Status", (STATUSES.find(function (s) { return s[0] === draft.status; }) || ["", ""])[1]],
      ["Breed", draft.breedType ? breedLine(draft) : ""],
    ];
    const relatives = draft.relatives.filter(slotFilled).map(function (row) {
      const label = (RELATIONSHIPS.find(function (r) { return r[0] === row.relationship; }) || ["", "Relative"])[1];
      return label + ": " + refName(data, row);
    });
    const pedigree = PEDIGREE.filter(function (position) {
      return slotFilled(draft.pedigree[position]);
    }).map(function (position) {
      return positionLabel(position) + ": " + refName(data, draft.pedigree[position]);
    });
    const list = function (items, empty) {
      return items.length
        ? '<ul class="list-disc pl-5">' + items.map(function (item) { return "<li>" + esc(item) + "</li>"; }).join("") + "</ul>"
        : '<p class="text-neutral-600">' + empty + "</p>";
    };
    return '<dl class="divide-y divide-neutral-200 rounded-lg border border-neutral-300 bg-white">' +
      rows.map(function (row) {
        return '<div class="grid grid-cols-3 gap-2 px-3 py-2"><dt class="font-medium">' + row[0] + '</dt><dd class="col-span-2">' + esc(row[1] || "Not given") + "</dd></div>";
      }).join("") +
      '<div class="px-3 py-2"><dt class="font-medium">Relatives</dt><dd class="mt-1">' + list(relatives, "None added") + "</dd></div>" +
      (opts.pedigree === false ? "" : '<div class="px-3 py-2"><dt class="font-medium">Pedigree (' + pedigree.length + " of " + PEDIGREE.length + ' places)</dt><dd class="mt-1">' + list(pedigree, "None") + "</dd></div>") +
      "</dl>";
  }

  /* ---------- Binding ---------- */

  function setPath(target, path, value) {
    const parts = path.split(".");
    let node = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (node[part] == null) {
        node[part] = {};
      }
      node = node[part];
    }
    node[parts[parts.length - 1]] = value;
  }

  /* Copy inputs into the draft, save, and run the live helpers.
   * onStructure(change) is called when rows are added or removed so the
   * prototype can re-render; onChange(path) after every value change. */
  function bind(container, flow, draft, hooks) {
    hooks = hooks || {};
    const onInput = function (event) {
      const element = event.target.closest("[data-bind]");
      if (!element || !container.contains(element)) {
        return;
      }
      if (element.type === "radio" && !element.checked) {
        return;
      }
      const path = element.getAttribute("data-bind");
      setPath(draft, path, element.value);
      saveDraft(flow, draft);
      clearError(container, path);
      refreshLive(container, draft);
      if (hooks.onChange) {
        hooks.onChange(path);
      }
      // A relationship change can free or take Dam or Sire, which changes
      // the other rows' choices, so redraw and keep focus on this field.
      if (/^relatives\.\d+\.relationship$/.test(path) && hooks.onStructure) {
        hooks.onStructure(idFor(path));
      }
    };
    container.addEventListener("input", onInput);
    container.addEventListener("change", onInput);
    container.addEventListener("click", function (event) {
      const button = event.target.closest("[data-action]");
      if (!button || !container.contains(button)) {
        return;
      }
      const action = button.getAttribute("data-action");
      const index = Number(button.getAttribute("data-index"));
      let focusAfter = null;
      if (action === "add-cross") {
        draft.cross.push({ breed: "", percent: "" });
        focusAfter = idFor("cross." + (draft.cross.length - 1) + ".breed");
      } else if (action === "remove-cross") {
        draft.cross.splice(index, 1);
        focusAfter = idFor("cross.0.breed");
      } else if (action === "add-relative") {
        draft.relatives.push({ relationship: "", ref: "", newName: "", newDetails: "" });
        focusAfter = idFor("relatives." + (draft.relatives.length - 1) + ".relationship");
      } else if (action === "remove-relative") {
        draft.relatives.splice(index, 1);
      } else {
        return;
      }
      saveDraft(flow, draft);
      if (hooks.onStructure) {
        hooks.onStructure(focusAfter);
      }
    });
  }

  /* The vanilla helper: show or hide breed sections and keep the crossbred
   * total live as people type. Works on whatever is currently rendered. */
  function refreshLive(container, draft) {
    container.querySelectorAll("[data-breed-section]").forEach(function (section) {
      section.hidden = section.getAttribute("data-breed-section") !== draft.breedType;
    });
    const hint = container.querySelector("[data-breed-hint]");
    if (hint) {
      hint.hidden = Boolean(draft.breedType);
    }
    const total = container.querySelector("[data-cross-total]");
    if (total) {
      const value = crossTotal(draft);
      total.textContent = totalText(value);
      total.className = "rounded px-3 py-2 text-sm font-semibold " + totalClass(value);
    }
  }

  function clearError(container, path) {
    const slot = container.querySelector('[data-error-for="' + path + '"]');
    if (slot) {
      slot.hidden = true;
      slot.textContent = "";
    }
    const field = document.getElementById(idFor(path));
    if (field) {
      field.removeAttribute("aria-invalid");
    }
  }

  /* Show errors next to fields and in a summary that takes focus. */
  function showErrors(container, errors) {
    container.querySelectorAll("[data-error-for]").forEach(function (slot) {
      slot.hidden = true;
      slot.textContent = "";
    });
    container.querySelectorAll("[aria-invalid]").forEach(function (field) {
      field.removeAttribute("aria-invalid");
    });
    const summary = container.querySelector("[data-error-summary]");
    const keys = Object.keys(errors);
    if (!keys.length) {
      if (summary) {
        summary.hidden = true;
        summary.innerHTML = "";
      }
      return true;
    }
    keys.forEach(function (key) {
      const slot = container.querySelector('[data-error-for="' + key + '"]');
      if (slot) {
        slot.hidden = false;
        slot.textContent = errors[key];
      }
      const field = document.getElementById(idFor(key));
      if (field) {
        field.setAttribute("aria-invalid", "true");
      }
    });
    if (summary) {
      summary.hidden = false;
      summary.innerHTML = '<h2 class="font-semibold">' + (keys.length === 1 ? "Please check one thing before continuing:" : "Please check these " + keys.length + " things before continuing:") + "</h2>" +
        '<ul class="mt-2 list-disc pl-5">' + keys.map(function (key) {
          return '<li><a class="underline" href="#' + idFor(key) + '">' + esc(errors[key]) + "</a></li>";
        }).join("") + "</ul>";
      summary.focus();
    }
    return false;
  }

  function errorSummary() {
    return '<div class="rounded-lg border-2 border-red-800 bg-white p-3 text-sm text-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-800" role="alert" tabindex="-1" data-error-summary hidden></div>';
  }

  /* ---------- Offline support ---------- */

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    const meta = document.querySelector('meta[name="app-root"]');
    const root = meta ? meta.getAttribute("content") : "./";
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(root + "sw.js", { scope: root }).catch(function () {
        /* Offline caching is a bonus; the pages work without it. */
      });
    });
  }

  registerServiceWorker();

  window.Proto = {
    STEPS: STEPS,
    PEDIGREE: PEDIGREE,
    GENERATION_NAMES: GENERATION_NAMES,
    load: load,
    reset: reset,
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    validate: validate,
    finish: finish,
    prefillPedigree: prefillPedigree,
    renderField: renderField,
    renderReview: renderReview,
    relationshipChoices: relationshipChoices,
    breedLine: breedLine,
    refName: refName,
    positionLabel: positionLabel,
    slotFilled: slotFilled,
    bind: bind,
    refreshLive: refreshLive,
    showErrors: showErrors,
    errorSummary: errorSummary,
    esc: esc,
    idFor: idFor,
  };
})();
