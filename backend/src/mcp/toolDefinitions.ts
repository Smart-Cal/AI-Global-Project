/**
 * MCP Tool Definitions for OpenAI Function Calling
 *
 * 에이전트가 사용할 수 있는 모든 MCP 도구 정의
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const mcpToolDefinitions: ChatCompletionTool[] = [
  // ====================================================
  // Google Calendar Tools
  // ====================================================
  {
    type: 'function',
    function: {
      name: 'calendar_create_event',
      description: '사용자의 Google Calendar에 새 일정을 생성합니다. 약속, 미팅, 회의 등을 직접 캘린더에 추가할 때 사용합니다.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '일정 제목'
          },
          date: {
            type: 'string',
            description: '일정 날짜 (YYYY-MM-DD 형식)'
          },
          startTime: {
            type: 'string',
            description: '시작 시간 (HH:mm 형식)'
          },
          endTime: {
            type: 'string',
            description: '종료 시간 (HH:mm 형식, 선택사항)'
          },
          location: {
            type: 'string',
            description: '장소 (선택사항)'
          },
          description: {
            type: 'string',
            description: '일정 설명 (선택사항)'
          }
        },
        required: ['title', 'date', 'startTime']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calendar_list_events',
      description: '특정 기간의 일정 목록을 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: '조회 시작 날짜 (YYYY-MM-DD)'
          },
          endDate: {
            type: 'string',
            description: '조회 종료 날짜 (YYYY-MM-DD)'
          }
        },
        required: ['startDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calendar_check_conflicts',
      description: '특정 시간대에 일정 충돌이 있는지 확인합니다.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: '확인할 날짜 (YYYY-MM-DD)'
          },
          startTime: {
            type: 'string',
            description: '시작 시간 (HH:mm)'
          },
          endTime: {
            type: 'string',
            description: '종료 시간 (HH:mm)'
          }
        },
        required: ['date', 'startTime', 'endTime']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calendar_get_free_busy',
      description: '그룹 멤버들의 Free/Busy 정보를 조회하여 모두가 가능한 시간을 찾습니다. 그룹 약속 잡기의 핵심 기능입니다.',
      parameters: {
        type: 'object',
        properties: {
          emails: {
            type: 'array',
            items: { type: 'string' },
            description: '조회할 멤버들의 이메일 목록'
          },
          startDate: {
            type: 'string',
            description: '조회 시작 날짜 (YYYY-MM-DD)'
          },
          endDate: {
            type: 'string',
            description: '조회 종료 날짜 (YYYY-MM-DD)'
          },
          preferredTimeOfDay: {
            type: 'string',
            enum: ['morning', 'afternoon', 'evening'],
            description: '선호하는 시간대 (선택사항)'
          }
        },
        required: ['emails', 'startDate', 'endDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calendar_update_event',
      description: '기존 일정을 수정합니다.',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: '수정할 일정 ID'
          },
          title: {
            type: 'string',
            description: '새 일정 제목 (선택사항)'
          },
          date: {
            type: 'string',
            description: '새 날짜 (YYYY-MM-DD, 선택사항)'
          },
          startTime: {
            type: 'string',
            description: '새 시작 시간 (HH:mm, 선택사항)'
          },
          endTime: {
            type: 'string',
            description: '새 종료 시간 (HH:mm, 선택사항)'
          },
          location: {
            type: 'string',
            description: '새 장소 (선택사항)'
          }
        },
        required: ['eventId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calendar_delete_event',
      description: '일정을 삭제합니다.',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: '삭제할 일정 ID'
          }
        },
        required: ['eventId']
      }
    }
  },

  // ====================================================
  // Google Maps Tools
  // ====================================================
  {
    type: 'function',
    function: {
      name: 'maps_search_places',
      description: '주변 장소를 검색합니다. 맛집, 카페, 모임 장소 등을 찾을 때 사용합니다.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '검색어 (예: "홍대 맛집", "강남역 카페")'
          },
          type: {
            type: 'string',
            enum: ['restaurant', 'cafe', 'bar', 'gym', 'park', 'movie_theater', 'shopping_mall'],
            description: '장소 유형 (선택사항)'
          },
          minRating: {
            type: 'number',
            description: '최소 평점 (1-5, 선택사항)'
          },
          priceLevel: {
            type: 'number',
            description: '가격대 (0-4, 0=저렴, 4=매우비쌈, 선택사항)'
          },
          openNow: {
            type: 'boolean',
            description: '현재 영업 중인 곳만 (선택사항)'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'maps_get_place_details',
      description: '특정 장소의 상세 정보를 조회합니다. 평점, 리뷰, 영업시간 등을 확인합니다.',
      parameters: {
        type: 'object',
        properties: {
          placeId: {
            type: 'string',
            description: '장소 ID (검색 결과에서 받은 ID)'
          }
        },
        required: ['placeId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'maps_get_distance',
      description: '두 장소 간의 거리와 이동 시간을 계산합니다.',
      parameters: {
        type: 'object',
        properties: {
          origin: {
            type: 'string',
            description: '출발지 (주소 또는 장소명)'
          },
          destination: {
            type: 'string',
            description: '도착지 (주소 또는 장소명)'
          },
          mode: {
            type: 'string',
            enum: ['driving', 'walking', 'transit', 'bicycling'],
            description: '이동 수단 (기본: transit)'
          }
        },
        required: ['origin', 'destination']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'maps_find_midpoint',
      description: '여러 사람의 위치를 고려하여 중간 지점을 찾고, 그 주변의 장소를 추천합니다.',
      parameters: {
        type: 'object',
        properties: {
          members: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '멤버 이름' },
                location: { type: 'string', description: '멤버 위치 (주소)' }
              },
              required: ['name', 'location']
            },
            description: '멤버 목록과 각자의 위치'
          },
          placeType: {
            type: 'string',
            description: '중간 지점 주변에서 찾을 장소 유형 (예: restaurant, cafe)'
          }
        },
        required: ['members']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'maps_recommend_restaurants',
      description: '특정 지역의 맛집을 추천합니다. 평점, 리뷰 수를 고려하여 최적의 장소를 제안합니다.',
      parameters: {
        type: 'object',
        properties: {
          area: {
            type: 'string',
            description: '지역명 (예: "홍대", "강남", "이태원")'
          },
          cuisine: {
            type: 'string',
            description: '음식 종류 (예: "한식", "이탈리안", "일식", 선택사항)'
          },
          minRating: {
            type: 'number',
            description: '최소 평점 (기본: 4.0)'
          },
          priceLevel: {
            type: 'number',
            description: '가격대 (0-4, 선택사항)'
          },
          limit: {
            type: 'number',
            description: '결과 수 (기본: 5)'
          }
        },
        required: ['area']
      }
    }
  },

  // ====================================================
  // Shopping Tools
  // ====================================================
  {
    type: 'function',
    function: {
      name: 'shopping_search',
      description: '상품을 검색합니다. 키워드, 가격대, 평점 등으로 필터링할 수 있습니다.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '검색 키워드'
          },
          minPrice: {
            type: 'number',
            description: '최소 가격 (원)'
          },
          maxPrice: {
            type: 'number',
            description: '최대 가격 (원)'
          },
          sort: {
            type: 'string',
            enum: ['relevance', 'price_asc', 'price_desc', 'rating'],
            description: '정렬 방식'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'shopping_compare_prices',
      description: '특정 상품의 가격을 여러 쇼핑몰에서 비교합니다.',
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: '상품명'
          }
        },
        required: ['productName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'shopping_goal_recommendations',
      description: '사용자의 목표에 맞는 상품을 추천합니다. 예: 운동 목표 → 운동용품 추천',
      parameters: {
        type: 'object',
        properties: {
          goalType: {
            type: 'string',
            enum: ['exercise', 'study', 'diet', 'hobby', 'travel', 'other'],
            description: '목표 유형'
          },
          goalDescription: {
            type: 'string',
            description: '목표 상세 설명'
          },
          budget: {
            type: 'number',
            description: '예산 (원, 선택사항)'
          }
        },
        required: ['goalType', 'goalDescription']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'shopping_recommend_gifts',
      description: '선물을 추천합니다. 받는 사람과 상황에 맞는 선물을 제안합니다.',
      parameters: {
        type: 'object',
        properties: {
          recipient: {
            type: 'string',
            enum: ['male', 'female', 'child', 'parent', 'friend'],
            description: '선물 받는 사람'
          },
          occasion: {
            type: 'string',
            enum: ['birthday', 'anniversary', 'holiday', 'graduation', 'other'],
            description: '상황/이벤트'
          },
          minPrice: {
            type: 'number',
            description: '최소 가격 (원)'
          },
          maxPrice: {
            type: 'number',
            description: '최대 가격 (원)'
          }
        },
        required: ['recipient', 'occasion']
      }
    }
  },

  // ====================================================
  // Integrated Tools (복합 기능)
  // ====================================================
  {
    type: 'function',
    function: {
      name: 'plan_group_meeting',
      description: '그룹 약속을 계획합니다. 멤버들의 일정을 확인하고, 최적 시간을 찾고, 장소를 추천합니다.',
      parameters: {
        type: 'object',
        properties: {
          groupName: {
            type: 'string',
            description: '그룹 이름'
          },
          memberEmails: {
            type: 'array',
            items: { type: 'string' },
            description: '멤버 이메일 목록'
          },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string', description: '시작 날짜 (YYYY-MM-DD)' },
              end: { type: 'string', description: '종료 날짜 (YYYY-MM-DD)' }
            },
            required: ['start', 'end'],
            description: '가능한 날짜 범위'
          },
          preferredArea: {
            type: 'string',
            description: '선호 지역 (선택사항)'
          },
          placeType: {
            type: 'string',
            enum: ['restaurant', 'cafe', 'bar'],
            description: '장소 유형'
          }
        },
        required: ['groupName', 'memberEmails', 'dateRange']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'prepare_special_day',
      description: '특별한 날(생일, 기념일 등)을 준비합니다. 일정 등록, 장소 추천, 선물 추천을 한 번에 처리합니다.',
      parameters: {
        type: 'object',
        properties: {
          occasion: {
            type: 'string',
            enum: ['birthday', 'anniversary', 'date', 'celebration'],
            description: '이벤트 종류'
          },
          date: {
            type: 'string',
            description: '날짜 (YYYY-MM-DD)'
          },
          recipient: {
            type: 'string',
            enum: ['male', 'female', 'friend', 'parent'],
            description: '대상'
          },
          preferredArea: {
            type: 'string',
            description: '선호 지역'
          },
          budget: {
            type: 'number',
            description: '예산 (원)'
          }
        },
        required: ['occasion', 'date', 'recipient']
      }
    }
  }
];

// 도구 이름으로 정의 찾기
export function getToolDefinition(toolName: string): ChatCompletionTool | undefined {
  return mcpToolDefinitions.find(tool => tool.function.name === toolName);
}

// 카테고리별 도구 분류
export const toolCategories = {
  calendar: [
    'calendar_create_event',
    'calendar_list_events',
    'calendar_check_conflicts',
    'calendar_get_free_busy',
    'calendar_update_event',
    'calendar_delete_event'
  ],
  maps: [
    'maps_search_places',
    'maps_get_place_details',
    'maps_get_distance',
    'maps_find_midpoint',
    'maps_recommend_restaurants'
  ],
  shopping: [
    'shopping_search',
    'shopping_compare_prices',
    'shopping_goal_recommendations',
    'shopping_recommend_gifts'
  ],
  integrated: [
    'plan_group_meeting',
    'prepare_special_day'
  ]
};
