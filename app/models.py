from pydantic import BaseModel, Field

############ THIS FILE IS TO LET THE AI KNOW HOW TO ANSWER ON THE JOB LISTING QUESTION ######################



class Job(BaseModel):
    title: str
    company: str
    location: str
    url: str
    score: int = Field(ge=1, le=10, description="How good does the role match the profile")
    reason: str = Field(description="A sentence about why")


class JobList(BaseModel):
    jobs: list[Job]


class JobInfo(BaseModel):
    title_line: int
    company_line: int
    location_line: int
    score: int = Field(ge=1, le=10)
    reason: str