// D-1133-08: Mock GitHub API fixture for anneal-detect tests
'use strict';

const MOCK_RUNS_HIT=[{
  id:1,name:'Baton Gates',conclusion:'failure',
  html_url:'https://github.com/chf3198/megingjord-harness/actions/runs/1',
  created_at:new Date().toISOString()
},{
  id:2,name:'CHANGELOG.md conflict detected',conclusion:'failure',
  html_url:'https://github.com/chf3198/megingjord-harness/actions/runs/2',
  created_at:new Date().toISOString()
}];

const MOCK_PRS_HIT=[{
  id:10,title:'fix: CHANGELOG.md conflict in merge',body:'resolves conflict',
  html_url:'https://github.com/chf3198/megingjord-harness/pull/10',
  updated_at:new Date().toISOString()
}];

const MOCK_RUNS_MISS=[{
  id:3,name:'CI passing',conclusion:'success',
  html_url:'https://github.com/chf3198/megingjord-harness/actions/runs/3',
  created_at:new Date().toISOString()
}];

function makeFetcher(runs,prs){
  return async function mockFetch(ep){
    if(ep.includes('/actions/runs'))return{workflow_runs:runs};
    if(ep.includes('/pulls'))return prs;
    return{};
  };
}

module.exports={
  fetchHit:makeFetcher(MOCK_RUNS_HIT,MOCK_PRS_HIT),
  fetchMiss:makeFetcher(MOCK_RUNS_MISS,[]),
  fetchEmpty:makeFetcher([],[]),
  MOCK_RUNS_HIT,MOCK_RUNS_MISS,MOCK_PRS_HIT
};
