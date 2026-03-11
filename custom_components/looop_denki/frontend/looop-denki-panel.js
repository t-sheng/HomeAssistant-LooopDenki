class LooopDenkiPanel extends HTMLElement {
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

  _drawChart(prices) {
    if (!Array.isArray(prices) || prices.length === 0) {
      return '<div class="empty">No data for selected day yet.</div>';
    }

    const width = 900;
    const height = 280;
    const padding = 24;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const points = prices
      .map((value, index) => {
        const x = padding + (index * (width - padding * 2)) / (prices.length - 1);
        const y = height - padding - ((value - min) * (height - padding * 2)) / range;
        return `${x},${y}`;
      })
      .join(" ");

    return `
      <svg viewBox="0 0 ${width} ${height}" class="chart">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis" />
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="axis" />
        <polyline points="${points}" class="price-line" />
        <text x="${padding}" y="16" class="label">Min: ${min.toFixed(2)} JPY</text>
        <text x="${width - 170}" y="16" class="label">Max: ${max.toFixed(2)} JPY</text>
      </svg>
    `;
  }

  render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    const { datasetEntity, daySelectEntity } = this._findEntities();
    if (!datasetEntity || !daySelectEntity) {
      this.shadowRoot.innerHTML = `
        <style>
          .card { padding: 16px; font-family: Arial, sans-serif; }
        </style>
        <div class="card">Looop Denki entities were not found. Set up the integration first.</div>
      `;
      return;
    }

    this._daySelectEntityId = daySelectEntity.entity_id;

    const selectedLabel = daySelectEntity.state;
    const selectedKey = (datasetEntity.attributes.selected_day || "today").toLowerCase();
    const prices = datasetEntity.attributes.selected_day_prices || [];

    const options = daySelectEntity.attributes.options || ["Yesterday", "Today", "Tomorrow"];
    const optionButtons = options
      .map((opt) => {
        const isActive = opt === selectedLabel;
        return `<button class="day-btn ${isActive ? "active" : ""}" data-opt="${opt}">${opt}</button>`;
      })
      .join("");

    this.shadowRoot.innerHTML = `
      <style>
        .wrap {
          padding: 16px;
          font-family: Arial, sans-serif;
        }
        .title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .subtitle {
          margin-bottom: 12px;
          color: #555;
        }
        .buttons {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .day-btn {
          border: 1px solid #666;
          background: #f2f2f2;
          color: #222;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .day-btn.active {
          background: #0f766e;
          color: white;
          border-color: #0f766e;
        }
        .chart {
          width: 100%;
          max-width: 900px;
          height: auto;
          border: 1px solid #ddd;
          border-radius: 10px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbfb 100%);
        }
        .axis {
          stroke: #999;
          stroke-width: 1;
        }
        .price-line {
          fill: none;
          stroke: #0f766e;
          stroke-width: 2.5;
        }
        .label {
          fill: #444;
          font-size: 12px;
        }
        .empty {
          color: #666;
          font-style: italic;
          padding: 12px 0;
        }
      </style>
      <div class="wrap">
        <div class="title">Looop Denki Price Chart</div>
        <div class="subtitle">Selected: ${selectedLabel} (${selectedKey})</div>
        <div class="buttons">${optionButtons}</div>
        ${this._drawChart(prices)}
      </div>
    `;

    this.shadowRoot.querySelectorAll(".day-btn").forEach((button) => {
      button.addEventListener("click", () => this._selectDay(button.dataset.opt));
    });
  }
}

customElements.define("looop-denki-panel", LooopDenkiPanel);
