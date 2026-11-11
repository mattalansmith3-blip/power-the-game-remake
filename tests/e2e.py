import sys, json, time
from playwright.sync_api import sync_playwright
URL = 'file:///workspace/power-game/index.html'
errors = []
def run(p, name, vw, vh, mobile):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': vw, 'height': vh}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append((name, m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append((name, 'pageerror', str(e))))
    page.goto(URL)
    page.screenshot(path=f'shots/{name}_start.png')
    assert page.is_visible('#startScreen')
    page.click('#btnRules2'); assert page.is_visible('#rulesModal'); page.screenshot(path=f'shots/{name}_rules.png'); page.click('#rulesModal [data-close]')
    page.click('#optOpp [data-v="2"]')
    page.click('#btnStart')
    assert not page.is_visible('#startScreen')
    assert page.is_visible('#hint'), 'hint visible'
    page.screenshot(path=f'shots/{name}_r1_start.png')
    def tap(space):
        page.evaluate("""(id)=>{const el=document.querySelector('[data-space="'+id+'"]'); el.dispatchEvent(new MouseEvent('click',{bubbles:true}));}""", space)
    # select HQ, click neighbor
    tap('nw_hq')
    assert page.evaluate('window.__game.sel && window.__game.sel.space') == 'nw_hq'
    assert page.locator('.node.target').count() >= 2
    page.screenshot(path=f'shots/{name}_selected.png')
    # reduce infantry count via stepper then send to nw_a
    page.click('[data-step="-1"][data-t="T"]')
    tap('nw_a')
    assert page.evaluate('window.__game.orders.length') == 1
    # second order: nw_a stack to north plains
    tap('nw_a'); tap('nt')
    assert page.evaluate('window.__game.orders.length') == 2
    # buy
    page.click('[data-buy="I"]')
    assert page.evaluate('window.__game.orders.length') == 3
    # undo works
    page.click('#btnUndo'); assert page.evaluate('window.__game.orders.length') == 2
    page.click('[data-del="1"]'); assert page.evaluate('window.__game.orders.length') == 1
    tap('nw_b'); tap('nl')
    tap('nw_hq'); 
    page.screenshot(path=f'shots/{name}_orders.png')
    page.click('#go')
    page.wait_for_timeout(600)
    page.screenshot(path=f'shots/{name}_reveal.png')
    # skip animation
    page.mouse.click(vw//2, vh//3)
    page.wait_for_function('window.__game.state.round === 2 && !window.__game.busy', timeout=20000)
    assert page.evaluate('window.__game.state.round') == 2
    assert page.locator('#log .rh').count() >= 1
    page.screenshot(path=f'shots/{name}_r2.png')
    # play more rounds quickly: go with simple orders
    for i in range(6):
        if page.evaluate('window.__game.state.over'): break
        page.click('#go')
        page.wait_for_function('!window.__game.busy', timeout=30000) if False else None
        page.wait_for_timeout(300)
        page.mouse.click(vw//2, vh//3)
        page.wait_for_function('!window.__game.busy', timeout=30000)
    print(name, 'round now', page.evaluate('window.__game.state.round'), 'orders per sanity ok')
    page.screenshot(path=f'shots/{name}_later.png')
    # play a full game to the end using the UI
    if not page.evaluate('window.__game.state.over'):
        for i in range(70):
            if page.evaluate('window.__game.state.over') or page.is_visible('#overModal'): break
            page.evaluate("document.getElementById('go').click()")
            page.wait_for_timeout(250)
            page.mouse.click(vw//2, vh//3)
            page.wait_for_function('!window.__game.busy', timeout=30000)
    print(name, 'game over:', page.evaluate('window.__game.state.over'), 'rounds', page.evaluate('window.__game.state.round'), 'modal', page.is_visible('#overModal'))
    page.screenshot(path=f'shots/{name}_over.png')
    if page.is_visible('#overModal'): page.click('#btnAgain')
    else: page.click('#btnNew')
    # timer option
    page.click('#optTimer [data-v="60"]'); page.click('#optOpp [data-v="1"]'); page.click('#optLvl [data-v="hard"]'); page.click('#btnStart')
    assert page.is_visible('#timerPill'), 'timer pill'
    page.screenshot(path=f'shots/{name}_hard.png')
    # horizontal overflow check
    sw = page.evaluate('document.documentElement.scrollWidth'); print(name, 'scrollWidth', sw, 'vw', vw)
    ctx.close(); b.close()
with sync_playwright() as p:
    run(p, 'desktop', 1280, 800, False)
    run(p, 'phone', 390, 844, True)
print('console problems:', errors)
sys.exit(1 if errors else 0)
