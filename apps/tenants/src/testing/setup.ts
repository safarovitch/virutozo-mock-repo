// jsdom has no modal <dialog> yet. This stand-in only toggles `open`, so stories render in the jsdom
// smoke test; focus trapping, Escape and focus return are tested in Chromium (`storybook-test`).
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
}
