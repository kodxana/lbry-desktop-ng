import { strict as assert } from 'assert';

export default async function stylesheets() {
  const frame = document.createElement('iframe');
  frame.style.height = '800px';
  frame.style.border = '0';
  const styles = Array.from(document.querySelectorAll('style'), (style) => style.textContent).join('\n');
  const loaded = new Promise((resolve) => {
    frame.onload = resolve;
  });
  frame.srcdoc = `<!doctype html><html style="font-size:16px"><head><style>${styles}</style></head><body>
    <div class="card__main-actions settings__row" id="settings">Wallet settings</div>
    <div class="card__actions" id="actions"><button>Backup</button><button>Encrypt</button></div>
    <div class="comments-own"><div class="comments-own--claim">
      <div class="channel-thumbnail" id="channel"><div class="ff-canvas"></div></div>
      <div class="media__thumb" id="media"><div class="ff-canvas"></div></div>
    </div></div>
    <div class="wunderbar__suggestion"><div class="media__thumb" id="search"><div class="ff-canvas"></div></div></div>
    <div class="storage__wrapper"><div class="storage__bar" id="storage">
      <div class="storage__other" style="width:50%"></div><div class="storage__private" style="width:50%"></div>
    </div></div>
    <div style="height:200px"><div class="first-run__image-wrapper" id="onboarding"><div class="privacy-img"></div></div></div>
    <div class="first-run__actions" id="setup-actions"><button>Back</button><button>Continue</button></div>
  </body></html>`;
  document.body.append(frame);
  try {
    await loaded;
    const root = frame.contentDocument.documentElement;
    const style = (selector) => frame.contentWindow.getComputedStyle(frame.contentDocument.querySelector(selector));
    const near = (actual, expected, message) => assert(Math.abs(parseFloat(actual) - expected) < 0.1, message);
    for (const width of [480, 900, 1280, 1700]) {
      frame.style.width = width + 'px';
      assert.equal(frame.contentWindow.innerWidth, width);
      for (const theme of ['dark', 'light']) {
        root.setAttribute('theme', theme);
        for (const direction of ['ltr', 'rtl']) {
          root.setAttribute('dir', direction);
          const context = `${width}px ${theme} ${direction}`;
          const endMargin = direction === 'rtl' ? 'marginLeft' : 'marginRight';
          near(style('#settings').paddingBottom, width <= 900 ? 0 : 16, 'Settings spacing: ' + context);
          assert.equal(style('#actions').flexWrap, width <= 900 ? 'wrap' : 'nowrap', context);
          near(style('#actions button:first-child')[endMargin], width <= 900 ? 32 / 3 : 16, context);
          near(style('#channel').width, 45, context);
          near(style('#channel .ff-canvas').height, 45, context);
          near(style('#channel')[endMargin], width >= 900 ? 32 / 3 : 8, context);
          near(style('#media').width, width <= 900 ? 160 : 96, context);
          near(style('#media').height, width <= 900 ? 90 : 54, context);
          near(style('#search').width, 80, context);
          near(style('#search').height, 45, context);
          near(style('#search .ff-canvas').height, 45, context);
          assert.equal(style('#storage').boxSizing, 'border-box', context);
          near(style('#storage').height, 48, context);
          near(style('#onboarding').height, 200, context);
          near(style('#onboarding .privacy-img').height, 240, context);
          assert.equal(style('#setup-actions').justifyContent, width >= 900 ? 'flex-start' : 'space-between', context);
        }
      }
    }
  } finally {
    frame.remove();
  }
}
