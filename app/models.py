from typing import Literal
from pydantic import BaseModel, Field

############ THIS FILE IS TO LET THE AI KNOW HOW TO ANSWER ON THE JOB LISTING QUESTION ######################

WorkMode = Literal["remote", "hybrid", "on-site", "unknown"]


# One job from the alert, with what code copied and what the model judged
class Job(BaseModel):
    title: str
    company: str
    location: str
    url: str
    score: int = Field(ge=1, le=10, description="How good does the role match the profile")
    reason: str = Field(description="A sentence about why")
    work_mode: WorkMode = "unknown"
    salary: str = ""
    matching_skills: list[str] = []
    missing_skills: list[str] = []


class JobList(BaseModel):
    jobs: list[Job]


# What the rank model returns for one job. Line numbers point at text that code copies
class JobInfo(BaseModel):
    title_line: int
    company_line: int
    location_line: int
    salary_line: int = Field(description="Line number with the salary, or -1 if no line shows a salary")
    score: int = Field(ge=1, le=10)
    reason: str = Field(description="One short sentence, at most 25 words, on the main reason for the score")
    matching_skills: list[str] = Field(description="Up to 3 of my skills rated 7 or higher that this job needs, most important first")
    missing_skills: list[str] = Field(description="Up to 3 things this job needs that I lack or rate 5 or lower, most important first. Empty if none")


# Facts about one company, pulled from the research
class CompanyFacts(BaseModel):
    company: str = Field(description="The company name exactly as in the job list")
    what_they_do: str = Field(description="One short sentence")
    employees: str = Field(description="Only a number or a range, like '120' or '200-280'. No sources or notes. 'unknown' if not found")
    founded: str = Field(description="Only the four digit year, like '2013'. No notes. 'unknown' if not found")
    salary_estimate: str = Field(description="Only a range in AUD, like '$120k-$140k'. No sources or notes. 'unknown' if not found")


class CompanyList(BaseModel):
    companies: list[CompanyFacts]