/* Index page: list the demo herd, show drafts in progress, and reset. */
(function () {
  "use strict";
  const P = window.Proto;
  const FLOWS = { a: "Prototype A", b: "Prototype B", c: "Prototype C" };

  function renderHerd() {
    const data = P.load();
    const list = document.getElementById("herd-list");
    list.innerHTML = data.rabbits.slice().reverse().map(function (rabbit) {
      const pedigree = Object.keys(rabbit.pedigree || {}).length;
      const relatives = (rabbit.relatives || []).map(function (row) {
        return row.relationship.replace("_", " ") + ": " + P.refName(data, { ref: row.ref });
      });
      const extra = [];
      if (relatives.length) {
        extra.push("Relatives: " + relatives.join("; "));
      }
      if (pedigree) {
        extra.push("Pedigree: " + pedigree + " of " + P.PEDIGREE.length + " places");
      }
      return '<li class="rounded-lg border border-neutral-300 bg-white px-3 py-2">' +
        '<p class="font-semibold">' + P.esc(rabbit.name) +
        (rabbit.demo ? ' <span class="ml-1 rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium">demo</span>' : "") +
        (rabbit.createdWith ? ' <span class="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-900">added with ' + P.esc(FLOWS[rabbit.createdWith] || "") + "</span>" : "") +
        "</p>" +
        '<p class="text-sm text-neutral-700">' + P.esc((rabbit.sex === "doe" ? "Doe" : "Buck") + " · " + rabbit.breedLine + " · " + rabbit.color + " · born " + rabbit.birthDate) + "</p>" +
        extra.map(function (line) { return '<p class="text-sm text-neutral-600">' + P.esc(line) + "</p>"; }).join("") +
        "</li>";
    }).join("");
    Object.keys(FLOWS).forEach(function (flow) {
      const badge = document.querySelector('[data-draft-for="' + flow + '"]');
      if (badge) {
        const draft = data.drafts[flow];
        badge.hidden = !draft;
        if (draft) {
          badge.textContent = "Draft in progress" + (draft.name ? ": " + draft.name : "");
        }
      }
    });
  }

  document.getElementById("reset-demo").addEventListener("click", function () {
    if (!window.confirm("Reset the demo herd and clear all drafts on this device?")) {
      return;
    }
    P.reset();
    renderHerd();
    document.getElementById("reset-status").textContent = "Demo data reset.";
  });

  renderHerd();
})();
