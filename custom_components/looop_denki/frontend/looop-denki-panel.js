class LooopDenkiPanel extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._daySelectEntityId = null;
    this._chartModel = null;
    this._boundSvg = null;
    this._boundMoveHandler = null;
    this._boundLeaveHandler = null;
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  async _selectDay(option) {
    if (!this._hass || !this._daySelectEntityId) {
      return;
    }
    await this._hass.callService("select", "select_option", {
      entity_id: this._daySelectEntityId,
      option,
    });
  }

  _findEntities() {
    if (!this._hass) {
      return { datasetEntity: null, daySelectEntity: null };
    }

    const states = Object.values(this._hass.states || {});
    const datasetEntity = states.find(
      (state) => state.attributes && state.attributes.looop_denki_dataset === "true"
    );
    const daySelectEntity = states.find(
      (state) => state.attributes && state.attributes.looop_denki_day_selector === "true"
    );

    return { datasetEntity, daySelectEntity };
  }

  _buildChartModel(prices) {
    if (!Array.isArray(prices) || prices.length === 0) {
      return null;
    }

    const width = Math.max(960, window.innerWidth - 64);
    const height = 360;
    const leftPadding = 56;
    const rightPadding = 24;
    const topPadding = 20;
    const bottomPadding = 34;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const plotWidth = width - leftPadding - rightPadding;
    const plotHeight = height - topPadding - bottomPadding;

    const points = prices.map((value, index) => {
      const denominator = prices.length > 1 ? prices.length - 1 : 1;
      const x = leftPadding + (index * plotWidth) / denominator;
      const y = topPadding + ((max - value) * plotHeight) / range;
      return { x, y, value };
    });

    const yTicks = 6;
    const yStep = range / yTicks;
    const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => min + yStep * i);

    return {
      width,
      height,
      leftPadding,
      rightPadding,
      topPadding,
      bottomPadding,
      min,
      max,
      plotWidth,
      plotHeight,
      points,
      yTickValues,
    };
  }

  _computeHighlightSets(prices) {
    const count = prices.length;
    if (!count) {
      return { highest: new Set(), lowest: new Set() };
    }

    const bucket = Math.max(1, Math.ceil(count * 0.1));
    const ranked = prices.map((value, index) => ({ value, index }));
    const highest = [...ranked]
      .sort((a, b) => b.value - a.value)
      .slice(0, bucket)
      .map((item) => item.index);
    const lowest = [...ranked]
      .sort((a, b) => a.value - b.value)
      .slice(0, bucket)
      .map((item) => item.index);

    return { highest: new Set(highest), lowest: new Set(lowest) };
  }

  _drawChart(model, prices, timeSlots) {
    if (!model) {
      return '<div class="empty">No data for selected day yet.</div>';
    }

    const points = model.points;
    const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
    const { highest, lowest } = this._computeHighlightSets(prices);
    const xCount = prices.length;
    const xStep = xCount > 1 ? model.plotWidth / (xCount - 1) : model.plotWidth;
    const startX = model.leftPadding - xStep / 2;

    const areaPath = `${polylinePoints} ${model.width - model.rightPadding},${model.height - model.bottomPadding} ${model.leftPadding},${model.height - model.bottomPadding}`;

    const hourBands = prices
      .map((_, index) => {
        const bandX = startX + index * xStep;
        const bandWidth = xStep;
        let cls = "hour-band";
        if (highest.has(index)) {
          cls += " high";
        } else if (lowest.has(index)) {
          cls += " low";
        }
        return `<rect x="${bandX}" y="${model.topPadding}" width="${bandWidth}" height="${model.plotHeight}" class="${cls}" />`;
      })
      .join("");

    const yGrid = model.yTickValues
      .map((tickValue) => {
        const y = model.topPadding + ((model.max - tickValue) * model.plotHeight) / (model.max - model.min || 1);
        return `
          <line x1="${model.leftPadding}" y1="${y}" x2="${model.width - model.rightPadding}" y2="${y}" class="grid-line" />
          <text x="${model.leftPadding - 8}" y="${y + 4}" class="tick-label y">${tickValue.toFixed(2)}</text>
        `;
      })
      .join("");

    const xLabels = points
      .map((point, index) => {
        if (index % 3 !== 0 && index !== xCount - 1) {
          return "";
        }
        const raw = Array.isArray(timeSlots) && timeSlots[index] ? timeSlots[index] : `${index}:00`;
        const label = String(raw).split("-")[0].trim();
        return `<text x="${point.x}" y="${model.height - 10}" text-anchor="middle" class="tick-label x">${label}</text>`;
      })
      .join("");

    const markerX = model.points[0]?.x ?? model.leftPadding;

    return `
      <div class="chart-wrap" id="chart-wrap">
        <svg viewBox="0 0 ${model.width} ${model.height}" class="chart" id="looop-chart-svg">
          <g class="plot-layer">
            ${hourBands}
            ${yGrid}
            <line
              x1="${model.leftPadding}"
              y1="${model.height - model.bottomPadding}"
              x2="${model.width - model.rightPadding}"
              y2="${model.height - model.bottomPadding}"
              class="axis"
            />
            <line
              x1="${model.leftPadding}"
              y1="${model.topPadding}"
              x2="${model.leftPadding}"
              y2="${model.height - model.bottomPadding}"
              class="axis"
            />
            ${xLabels}
            <polygon points="${areaPath}" class="price-area" />
            <polyline points="${polylinePoints}" class="price-line" />
          </g>
          <line id="hover-line" class="hover-line" x1="${markerX}" x2="${markerX}" y1="${model.topPadding}" y2="${model.height - model.bottomPadding}" />
          <circle id="hover-dot" r="4" class="hover-dot" cx="${markerX}" cy="${model.height - model.bottomPadding}"></circle>
        </svg>
        <div id="hover-tooltip" class="tooltip"></div>
      </div>
    `;
  }

  _bindChartInteractions(prices, timeSlots) {
    if (!this.shadowRoot || !this._chartModel) {
      return;
    }

    const svg = this.shadowRoot.querySelector("#looop-chart-svg");
    const wrap = this.shadowRoot.querySelector("#chart-wrap");
    const hoverLine = this.shadowRoot.querySelector("#hover-line");
    const hoverDot = this.shadowRoot.querySelector("#hover-dot");
    const tooltip = this.shadowRoot.querySelector("#hover-tooltip");

    if (!svg || !wrap || !hoverLine || !hoverDot || !tooltip) {
      this._teardownChartInteractions();
      return;
    }

    if (this._boundSvg && this._boundSvg !== svg) {
      this._teardownChartInteractions();
    }

    const model = this._chartModel;
    const now = new Date();
    const currentSlotHourFraction = now.getHours() + (Math.floor(now.getMinutes() / 30) * 0.5);
    const defaultIndex = Math.max(
      0,
      Math.min(prices.length - 1, Math.floor(currentSlotHourFraction / 0.5))
    );

    const renderMarker = (index, clientX, clientY) => {
      const point = model.points[index];
      if (!point) {
        return;
      }

      const slotLabel = Array.isArray(timeSlots) && timeSlots[index] ? timeSlots[index] : `Slot ${index}`;
      const price = prices[index];

      hoverLine.setAttribute("x1", String(point.x));
      hoverLine.setAttribute("x2", String(point.x));
      hoverLine.setAttribute("y1", String(model.topPadding));
      hoverLine.setAttribute("y2", String(model.height - model.bottomPadding));

      hoverDot.setAttribute("cx", String(point.x));
      hoverDot.setAttribute("cy", String(point.y));

      tooltip.textContent = `${slotLabel}  ${price.toFixed(2)} JPY`;

      const wrapRect = wrap.getBoundingClientRect();
      const visualX = typeof clientX === "number"
        ? clientX - wrapRect.left + 10
        : ((point.x / model.width) * wrapRect.width) + 10;
      const visualY = typeof clientY === "number"
        ? clientY - wrapRect.top - 30
        : ((point.y / model.height) * wrapRect.height) - 30;

      tooltip.style.left = `${Math.max(8, Math.min(wrapRect.width - 200, visualX))}px`;
      tooltip.style.top = `${Math.max(8, visualY)}px`;
    };

    if (this._boundSvg === svg) {
      renderMarker(defaultIndex);
      return;
    }

    const indexFromEvent = (event) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height || prices.length === 0) {
        return defaultIndex;
      }

      const relativeX = event.clientX - rect.left;
      const localX = (relativeX / rect.width) * model.width;

      const minX = model.leftPadding;
      const maxX = model.width - model.rightPadding;
      const clampedX = Math.max(minX, Math.min(maxX, localX));
      const normalized = (clampedX - model.leftPadding) / (model.plotWidth || 1);
      const rawIndex = normalized * (prices.length - 1);
      return Math.max(0, Math.min(prices.length - 1, Math.round(rawIndex)));
    };

    this._boundMoveHandler = (event) => {
      const index = indexFromEvent(event);
      renderMarker(index, event.clientX, event.clientY);
    };

    this._boundLeaveHandler = () => {
      renderMarker(defaultIndex);
    };

    this._boundSvg = svg;
    svg.addEventListener("mousemove", this._boundMoveHandler);
    svg.addEventListener("mouseenter", this._boundMoveHandler);
    svg.addEventListener("mouseleave", this._boundLeaveHandler);

    renderMarker(defaultIndex);
  }

  _teardownChartInteractions() {
    if (!this._boundSvg) {
      return;
    }

    if (this._boundMoveHandler) {
      this._boundSvg.removeEventListener("mousemove", this._boundMoveHandler);
      this._boundSvg.removeEventListener("mouseenter", this._boundMoveHandler);
    }
    if (this._boundLeaveHandler) {
      this._boundSvg.removeEventListener("mouseleave", this._boundLeaveHandler);
    }

    this._boundSvg = null;
    this._boundMoveHandler = null;
    this._boundLeaveHandler = null;
  }

  render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    const { datasetEntity, daySelectEntity } = this._findEntities();
    if (!datasetEntity || !daySelectEntity) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; }
          .card {
            padding: 16px;
            color: var(--primary-text-color, #1f1f1f);
            background: var(--card-background-color, #ffffff);
            border-radius: var(--ha-card-border-radius, 12px);
          }
        </style>
        <div class="card">Looop Denki entities were not found. Set up the integration first.</div>
      `;
      return;
    }

    this._daySelectEntityId = daySelectEntity.entity_id;

    const selectedLabel = daySelectEntity.state;
    const selectedKey = (datasetEntity.attributes.selected_day || "today").toLowerCase();
    const prices = datasetEntity.attributes.selected_day_prices || [];
    const timeSlots = datasetEntity.attributes.selected_day_time_slots || [];

    this._chartModel = this._buildChartModel(prices);

    const options = daySelectEntity.attributes.options || ["Yesterday", "Today", "Tomorrow"];
    const optionButtons = options
      .map((opt) => {
        const isActive = opt === selectedLabel;
        return `<button class="day-btn ${isActive ? "active" : ""}" data-opt="${opt}">${opt}</button>`;
      })
      .join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color, #1f1f1f);
        }
        .wrap {
          padding: 16px;
          font-family: var(--paper-font-common-base_-_font-family, Arial, sans-serif);
          color: var(--primary-text-color, #1f1f1f);
          background: var(--card-background-color, #ffffff);
          border-radius: var(--ha-card-border-radius, 12px);
        }
        .title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .subtitle {
          margin-bottom: 12px;
          color: var(--secondary-text-color, #6c6c6c);
        }
        .buttons {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .day-btn {
          border: 1px solid var(--divider-color, #9d9d9d);
          background: var(--secondary-background-color, #f4f4f4);
          color: var(--primary-text-color, #1f1f1f);
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .day-btn.active {
          background: var(--primary-color, #0f766e);
          color: var(--text-primary-color, #ffffff);
          border-color: var(--primary-color, #0f766e);
        }
        .chart-wrap {
          position: relative;
          width: 100%;
          border: 1px solid var(--divider-color, #d7d7d7);
          border-radius: 10px;
          background: var(--card-background-color, #ffffff);
        }
        .chart {
          width: 100%;
          height: auto;
          display: block;
        }
        .axis {
          stroke: var(--divider-color, #9f9f9f);
          stroke-width: 1;
        }
        .grid-line {
          stroke: color-mix(in srgb, var(--divider-color, #cfcfcf) 70%, transparent);
          stroke-width: 1;
        }
        .tick-label {
          fill: var(--secondary-text-color, #6c6c6c);
          font-size: 11px;
        }
        .tick-label.x {
          dominant-baseline: middle;
        }
        .hour-band {
          fill: transparent;
        }
        .hour-band.high {
          fill: color-mix(in srgb, var(--error-color, #db4437) 18%, transparent);
        }
        .hour-band.low {
          fill: color-mix(in srgb, var(--success-color, #2e7d32) 18%, transparent);
        }
        .price-area {
          fill: color-mix(in srgb, var(--primary-color, #0f766e) 18%, transparent);
          stroke: none;
        }
        .price-line {
          fill: none;
          stroke: var(--primary-color, #0f766e);
          stroke-width: 2.5;
        }
        .hover-line {
          stroke: var(--secondary-text-color, #8a8a8a);
          stroke-width: 1.5;
          stroke-dasharray: 4 4;
        }
        .hover-dot {
          fill: var(--accent-color, var(--primary-color, #0f766e));
          stroke: var(--card-background-color, #ffffff);
          stroke-width: 2;
        }
        .empty {
          color: var(--secondary-text-color, #666666);
          font-style: italic;
          padding: 12px 0;
        }
        .tooltip {
          position: absolute;
          padding: 6px 8px;
          font-size: 12px;
          border-radius: 6px;
          border: 1px solid var(--divider-color, #b0b0b0);
          background: var(--ha-card-background, var(--card-background-color, #ffffff));
          color: var(--primary-text-color, #1f1f1f);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
          pointer-events: none;
          white-space: nowrap;
        }
      </style>
      <div class="wrap">
        <div class="title">Looop Denki Price Chart</div>
        <div class="subtitle">Selected: ${selectedLabel} (${selectedKey})</div>
        <div class="buttons">${optionButtons}</div>
        ${this._drawChart(this._chartModel, prices, timeSlots)}
      </div>
    `;

    this.shadowRoot.querySelectorAll(".day-btn").forEach((button) => {
      button.addEventListener("click", () => this._selectDay(button.dataset.opt));
    });

    this._bindChartInteractions(prices, timeSlots);
  }
}

customElements.define("looop-denki-panel", LooopDenkiPanel);
