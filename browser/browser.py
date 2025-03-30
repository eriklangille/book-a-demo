# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "browser-use",
#     "langchain-openai",
#     "pydantic",
#     "python-dotenv",
# ]
# ///
import os
import sys
import json
import argparse
import asyncio

from browser_use.browser.context import BrowserContext

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from browser_use import ActionResult, Agent, Controller
from browser_use.browser.browser import Browser, BrowserConfig

load_dotenv()
if not os.getenv('OPENAI_API_KEY'):
	raise ValueError('OPENAI_API_KEY is not set. Please add it to your environment variables.')

class Field(BaseModel):
	field_name: str

class Fields(BaseModel):
	requiredFields: list[Field]

class Result(BaseModel):
	success: bool
	scheduled_email: str
	scheduled_time: str

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
			chrome_instance_path= os.getenv('CHROME_INSTANCE_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
		),
	)

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
			  On the {website_url} webpage, find and select the button that schedules a product demo.
				Select the first available demo time.
				Fill out the appointment with the following profile:
				{profile}

				If there are any missing fields in the profile that are required to book a demo, use 'Output required fields to book a demo' and end the execution.
				Do NOT GUESS ANY FIELDS. THIS WILL RESULT IN A FAILED BOOKING. DO NOT USE 'John Doe' or 'test@test.com'. **If you cannot find the required fields**, use 'Output required fields to book a demo'.
				If there are missing fields and you have outputted the required fields, do NOT book a demo. Instead, end the execution.

				If all required fields are present, use 'Output result of booking a demo' BEFORE ending the execution once the demo has been booked. Without using the 'Output result of booking a demo' action,
				the user will not know that the demo has been booked.
			""".format(profile=json.dumps(profile), website_url=website_url),
			llm=model,
			browser_context=context,
			controller=controller,
		)
		print("Running booker")
		await booker.run()
  
async def mainMock(profile: dict, website_url: str):
	for _ in range(5):
		print(f"Mocking {profile} on {website_url}", flush=True)
		await asyncio.sleep(1)
	output({'requiredFields': [{'field_name': 'email'}, {'field_name': 'name'}]})
	# output({'result': {'success': True, 'demo_scheduled_time': '2025-03-30 10:00:00', 'message': 'Demo scheduled for 2025-03-30 10:00:00'}})

if __name__ == '__main__':
	parser = argparse.ArgumentParser()
	parser.add_argument('profile', type=json.loads)
	parser.add_argument('website_url', type=str)
	args = parser.parse_args()

	print(f"Args: {args}")

	asyncio.run(main(args.profile, args.website_url))

