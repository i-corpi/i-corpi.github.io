document.addEventListener("DOMContentLoaded", () => {
  const goal = document.getElementById("learning-goal");
  const representation = document.getElementById("action-representation");
  const datasets = [...document.querySelectorAll("[data-dataset]")];
  const examples = [...document.querySelectorAll("[data-action-example]")];
  const readChoice = (select, value) => {
    select.value = [...select.options].some(option => option.value === value) ? value : select.options[0].value;
  };
  const render = (save = true) => {
    let count = 0;
    datasets.forEach(card => {
      card.hidden = goal.value !== "all" && !card.dataset.goals.split(" ").includes(goal.value);
      if (!card.hidden) count++;
    });
    document.getElementById("dataset-count").textContent = `${count} of ${datasets.length} sources`;
    document.querySelectorAll("[data-goal-note]").forEach(note => { note.hidden = note.dataset.goalNote !== goal.value; });
    examples.forEach(example => { example.hidden = example.dataset.actionExample !== representation.value; });
    if (save) {
      const url = new URL(location.href);
      if (goal.value === "all") url.searchParams.delete("goal");
      else url.searchParams.set("goal", goal.value);
      if (representation.value === "pose") url.searchParams.delete("action");
      else url.searchParams.set("action", representation.value);
      history.replaceState(null, "", url);
    }
  };
  const restore = () => {
    const params = new URL(location.href).searchParams;
    readChoice(goal, params.get("goal"));
    readChoice(representation, params.get("action"));
    render(false);
  };
  document.querySelector("[data-dataset-filter]").hidden = false;
  document.querySelector("[data-action-filter]").hidden = false;
  goal.addEventListener("change", () => render());
  representation.addEventListener("change", () => render());
  window.addEventListener("popstate", restore);
  restore();
});
