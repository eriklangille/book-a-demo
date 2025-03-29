import os
import sys
import json
import argparse
import asyncio
from contextlib import redirect_stdout

from browser_use.browser.context import BrowserContext

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from browser_use import ActionResult, Agent, Controller
from browser_use.browser.browser import Browser, BrowserConfig

class Field(BaseModel):
	name: str

class Fields(BaseModel):
	fields: list[Field]

controller = Controller()

def output(message: dict):
	print(f'>>>{json.dumps(message)}')

@controller.registry.action('Webpage: Open a specific webpage')
async def open_webpage(browser: BrowserContext, website_url: str):
	page = await browser.get_current_page()
	if page.url != website_url:
		await page.goto(website_url)
		await page.wait_for_load_state()
	return ActionResult(extracted_content=f'Opened webpage {website_url}', include_in_memory=False)

async def main():
	browser = Browser(
		config=BrowserConfig(
			chrome_instance_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		),
	)

	# Load environment variables
	load_dotenv()
	if not os.getenv('OPENAI_API_KEY'):
		raise ValueError('OPENAI_API_KEY is not set. Please add it to your environment variables.')

	async with await browser.new_context() as context:
		model = ChatOpenAI(model='gpt-4o')

		eraser = Agent(
			task="""
				Open the webpage {website_url}
			""",
			llm=model,
			browser_context=context,
			controller=controller,
		)
		await eraser.run()

		researcher = Agent(
			task="""
				Google to find the full name, nationality, and date of birth of the CEO of the top 10 Fortune 100 companies.
				For each company, append a row to this existing Google Sheet: https://docs.google.com/spreadsheets/d/1INaIcfpYXlMRWO__de61SHFCaqt1lfHlcvtXZPItlpI/edit
				Make sure column headers are present and all existing values in the sheet are formatted correctly.
				Columns:
					A: Company Name
					B: CEO Full Name
					C: CEO Country of Birth
					D: CEO Date of Birth (YYYY-MM-DD)
					E: Source URL where the information was found
			""",
			llm=model,
			browser_context=context,
			controller=controller,
		)
		await researcher.run()
  
async def mainMock(profile: dict):
		print("Mocking main")
		output({'requiredFields': ['email', 'name']})

if __name__ == '__main__':
	parser = argparse.ArgumentParser()
	parser.add_argument('profile', type=json.loads)
	args = parser.parse_args()

	asyncio.run(mainMock(args.profile))

