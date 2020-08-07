describe('onboarding', () => {
  beforeEach(async () => {
    await ms.visit('/')
  })

  it('should show welcome screen on first visit', async () => {
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.type('#profile_username', 'default')
    await ms.screenshot('welcome')
    await page.click('#getstarted')
    await page.waitForSelector('#startsession')
  })

  it('should show home on next visit', async () => {
    await page.waitForSelector('#startsession')
  })
})
