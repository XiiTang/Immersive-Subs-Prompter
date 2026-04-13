const measureText = (text: string, font = "16px sans-serif") => {
  const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
  const fontSize = sizeMatch ? Number(sizeMatch[1]) : 16;
  return text.length * fontSize * 0.58;
};

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: function getContext() {
    return {
      font: "",
      measureText(text: string) {
        return {
          width: measureText(text, this.font)
        };
      }
    };
  }
});

Object.defineProperty(HTMLElement.prototype, "scrollTo", {
  value(options: ScrollToOptions) {
    if (typeof options.top === "number") {
      this.scrollTop = options.top;
    }
    if (typeof options.left === "number") {
      this.scrollLeft = options.left;
    }
  }
});
