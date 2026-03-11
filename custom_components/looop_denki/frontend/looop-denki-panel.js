class LooopDenkiPanel extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._daySelectEntityId = null;
    this._chartModel = null;
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

    const width = 960;
    const height = 320;
    const leftPadding = 40;
    const rightPadding = 24;
    const topPadding = 28;
    const bottomPadding = 28;

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
      points,
    };
  }

  _drawChart(model) {
    if (!model) {
      return '<div class="empty">No data for selected day yet.</div>';
    }

    const polylinePoints = model.points.map((point) => `${point.x},${point.y}`).join(" ");

    return `
      <div class="chart-wrap">
        <svg viewBox="0 0 ${model.width} ${model.height}" class="chart" id="looop-chart-svg">
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
          <polyline points="${polylinePoints}" class="price-line" />
          <line id="hover-line" class="hover-line hidden" />
          <circle id="hover-dot" r="4" class="hover-dot hidden"></circle>
          <text x="${model.leftPadding}" y="16" class="label">Min: ${model.min.toFixed(2)} JPY</text>
          <text x="${model.width - 184}" y="16" class="label">Max: ${model.max.toFixed(2)} JPY</text>
        </svg>
        <div id="hover-tooltip" class="tooltip hidden"></div>
      </div>
    `;
  }

  _bindChartHover(prices, timeSlots) {
    if (!this.shadowRoot || !this._chartModel) {
      return;
    }

    const svg = this.shadowRoot.querySelector("#looop-chart-svg");
    const wrap = this.shadowRoot.querySelector(".chart-wrap");
    const hoverLine = this.shadowRoot.querySelector("#hover-line");
    const hoverDot = this.shadowRoot.querySelector("#hover-dot");
    const tooltip = this.shadowRoot.querySelector("#hover-tooltip");

    if (!svg || !wrap || !hoverLine || !hoverDot || !tooltip) {
      return;
    }

    const model = this._chartModel;

    const clearHover = () => {
      hoverLine.classList.add("hidden");
      hoverDot.classList.add("hidden");
      tooltip.classList.add("hidden");
    };

    const showHover = (event) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height || prices.length === 0) {
        clearHover();
        return;
      }

      const relativeX = event.clientX - rect.left;
      const viewBoxX = (relativeX / rect.width) * model.width;
      const minX = model.leftPadding;
      const maxX = model.width - model.rightPadding;
      const clampedX = Math.max(minX, Math.min(maxX, viewBoxX));

      const denominator = model.plotWidth || 1;
      const rawIndex = ((clampedX - model.leftPadding) / denominator) * (prices.length - 1);
      const index = Math.max(0, Math.min(prices.length - 1, Math.round(rawIndex)));

      const point = model.points[index];
      const slotLabel = Array.isArray(timeSlots) && timeSlots[index] ? timeSlots[index] : `Slot ${index}`;
      const price = prices[index];

      hoverLine.setAttribute("x1", String(point.x));
      hoverLine.setAttribute("x2", String(point.x));
      hoverLine.setAttribute("y1", String(model.topPadding));
      hoverLine.setAttribute("y2", String(model.height - model.bottomPadding));
      hoverLine.classList.remove("hidden");

      hoverDot.setAttribute("cx", String(point.x));
      hoverDot.setAttribute("cy", String(point.y));
      hoverDot.classList.remove("hidden");

      tooltip.textContent = `${slotLabel}  ${price.toFixed(2)} JPY`;
      tooltip.classList.remove("hidden");

      const wrapRect = wrap.getBoundingClientRect();
      const tooltipX = event.clientX - wrapRect.left + 10;
      const tooltipY = event.clientY - wrapRect.top - 30;

      tooltip.style.left = `${Math.max(8, Math.min(wrapRect.width - 170, tooltipX))}px`;
      tooltip.style.top = `${Math.max(8, tooltipY)}px`;
    };

    svg.addEventListener("mousemove", showHover);
    svg.addEventListener("mouseenter", showHover);
    svg.addEventListener("mouseleave", clearHover);
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
        }
        .chart {
          width: 100%;
          max-width: 960px;
          height: auto;
          border: 1px solid var(--divider-color, #d7d7d7);
          border-radius: 10px;
          background: var(--card-background-color, #ffffff);
        }
        .axis {
          stroke: var(--divider-color, #9f9f9f);
          stroke-width: 1;
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
        .label {
          fill: var(--secondary-text-color, #5e5e5e);
          font-size: 12px;
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
        .hidden {
          opacity: 0;
          visibility: hidden;
        }
      </style>
      <div class="wrap">
        <div class="title">Looop Denki Price Chart</div>
        <div class="subtitle">Selected: ${selectedLabel} (${selectedKey})</div>
        <div class="buttons">${optionButtons}</div>
        ${this._drawChart(this._chartModel)}
      </div>
    `;

    this.shadowRoot.querySelectorAll(".day-btn").forEach((button) => {
      button.addEventListener("click", () => this._selectDay(button.dataset.opt));
    });

    this._bindChartHover(prices, timeSlots);
  }
}

customElements.define("looop-denki-panel", LooopDenkiPanel);