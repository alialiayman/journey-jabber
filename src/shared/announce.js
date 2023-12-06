const announce = (text) => {
  if ("speechSynthesis" in window) {
    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);

    synthesis.speak(utterance);
  }
};

export const stopAnnouncement = () => {
  if ("speechSynthesis" in window) {
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
  }
};

export default announce;
