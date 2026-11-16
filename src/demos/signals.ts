import { Hono } from 'hono';
import { html } from '../lib/html.ts';

// This demo has no endpoints. Everything below runs in the browser.
export const routes = new Hono();

export const view = () => html`
  <div
    class="plan"
    data-signals="{team: '', seats: 8, yearly: true, extras: {sso: false, audit: true, support: false}}"
    data-computed:seat-price="$yearly ? 8 : 10"
    data-computed:extras-price="($extras.sso ? 4 : 0) + ($extras.audit ? 3 : 0) + ($extras.support ? 6 : 0)"
    data-computed:total="$seats * ($seatPrice + $extrasPrice)"
  >
    <div class="plan-form">
      <label class="field">
        <span>Team name</span>
        <input type="text" placeholder="Apollo" maxlength="20" autocomplete="off" data-bind:team />
      </label>

      <label class="field">
        <span>Seats <output data-text="$seats"></output></span>
        <input type="range" min="1" max="50" data-bind:seats />
      </label>

      <label class="check">
        <input type="checkbox" data-bind:yearly />
        <span>Bill yearly</span>
        <em data-show="$yearly">20% off</em>
      </label>

      <fieldset class="extras">
        <legend>Extras, per seat</legend>
        <label class="check"><input type="checkbox" data-bind:extras.sso /> <span>Single sign-on</span> <i>$4</i></label>
        <label class="check"><input type="checkbox" data-bind:extras.audit /> <span>Audit log</span> <i>$3</i></label>
        <label class="check"><input type="checkbox" data-bind:extras.support /> <span>Priority support</span> <i>$6</i></label>
        <div class="bulk">
          <button type="button" class="button small" data-on:click="@setAll(true, {include: /^extras\./})">All</button>
          <button type="button" class="button small" data-on:click="@setAll(false, {include: /^extras\./})">None</button>
          <button type="button" class="button small" data-on:click="@toggleAll({include: /^extras\./})">Invert</button>
        </div>
      </fieldset>
    </div>

    <div class="plan-summary" data-class:is-big="$seats >= 25">
      <p class="plan-team" data-text="$team.trim() || 'Your team'"></p>
      <p class="plan-total"><span data-text="'$' + $total"></span><small> / month</small></p>
      <p class="plan-sums" data-text="$seats + ' seats × $' + ($seatPrice + $extrasPrice) + ' each'"></p>
      <div class="meter"><i data-style:width="$seats * 2 + '%'"></i></div>
      <p class="plan-note" data-show="$seats >= 25">That is a big team. Talk to us about volume pricing.</p>
      <button
        class="button primary"
        data-attr:disabled="$team.trim() === ''"
        data-text="$team.trim() ? 'Start ' + $team.trim() : 'Name your team first'"
      ></button>
    </div>

    <div class="plan-signals">
      <h3>Live signals</h3>
      <pre data-json-signals="{exclude: /^_/}"></pre>
    </div>
  </div>
`;
