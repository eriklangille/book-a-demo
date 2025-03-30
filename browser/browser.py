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
	requiredFields: list[Field]

class Result(BaseModel):
	success: bool
	demo_scheduled_time: str
	message: str

controller = Controller()

def output(message: dict):
	print(f'>>>{json.dumps(message)}', flush=True)

@controller.action('Output required fields to book a demo', param_model=Fields)
async def output_required_fields(required_fields: Fields):
	output(required_fields.model_dump(mode='json'))

@controller.action('Output result of booking a demo', param_model=Result)
async def output_result(result: Result):
	output({ 'result': result.model_dump(mode='json')})

@controller.registry.action('Webpage: Open a specific webpage')
async def open_webpage(browser: BrowserContext, website_url: str):
	page = await browser.get_current_page()
	if page.url != website_url:
		await page.goto(website_url)
		await page.wait_for_load_state()
	return ActionResult(extracted_content=f'Opened webpage {website_url}', include_in_memory=False)

async def main(profile: dict, website_url: str):
	print(f"Booking demo for {profile} on {website_url}")
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

		opener = Agent(
			task="""
				Open the webpage {website_url}
			""".format(website_url=website_url),
			llm=model,
			browser_context=context,
			controller=controller,
		)
		print("Running opener")
		await opener.run()

		booker = Agent(
			task="""
			  On the current webpage, find and select the button that schedules a product demo.
				Select the first available demo time.
				Fill out the required fields with the following profile:
				{profile}

				If there are any missing required fields, output the required fields and end the execution.
				Otherwise, output the result of booking a demo.
			""".format(profile=json.dumps(profile)),
			llm=model,
			browser_context=context,
			controller=controller,
		)
		print("Running booker")
		await booker.run()
  
async def mainMock(profile: dict, website_url: str):
	for _ in range(10):
		print(f"Mocking {profile} on {website_url}", flush=True)
		await asyncio.sleep(1)
	# output({'requiredFields': ['email', 'name']})
	output({'result': {'success': True, 'demo_scheduled_time': '2025-03-30 10:00:00', 'message': 'Demo scheduled for 2025-03-30 10:00:00'}})

if __name__ == '__main__':
	parser = argparse.ArgumentParser()
	parser.add_argument('profile', type=json.loads)
	parser.add_argument('website_url', type=str)
	args = parser.parse_args()

	print(f"Args: {args}")

	asyncio.run(main(args.profile, args.website_url))

