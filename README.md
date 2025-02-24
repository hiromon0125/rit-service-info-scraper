This is a project for rit bus schedule where it needs to scrape the service info on rit bus website and serve data for the main site. 

The technologies used are cloudflare workers, hono, axios, and cheerio.


## Setup
```
pnpm install
pnpm run dev
```
for environmental variables:
```
cp example.vars .dev.vars
```
Change the variables to your setup.
> [!NOTE]
> Vars is cloudflare's way of doing environmetal variables. This is where sercret keys are stored for cloudflare workers. I would also recommend creating the same file for production environment with `cp example.vars .prod.vars`.

This app has a simple secret key protection that needs to be set on the header to work. While this isn't the most secure way to do it, its the simplest and does the job for most part. The rest will be secured by strictly requesting it through server side and never reveal on the client code.


## Deployment
```
pnpm wrangler login
pnpm run deploy
```
