# Demo Accounts And Institutions

These accounts are inserted by `demo_oncampus_institution_seed.sql`.

Use them only in a non-production Supabase project. For local/dev OTP login, run the backend with:

```env
DEV_MODE=true
DEV_OTP_CODE=123456
```

## Login Accounts

| Name | Role | Phone | OTP | User ID | Institution |
| --- | --- | --- | --- | --- | --- |
| Aarav Sharma | Student | `+919100000101` | `123456` | `demo_oc_user_aarav` | IIT Bombay Demo Campus |
| Priya Nair | Student | `+919100000102` | `123456` | `demo_oc_user_priya` | IIT Bombay Demo Campus |
| Dr. Ramesh Iyer | Institution admin/faculty | `+919100000103` | `123456` | `demo_oc_user_iyer` | IIT Bombay Demo Campus |
| Zara Fernandes | Student and institution admin | `+919100000104` | `123456` | `demo_oc_user_zara` | St. Xavier's Demo College |

## Institutions

| Institution | ID | City | Admin User |
| --- | --- | --- | --- |
| IIT Bombay Demo Campus | `demo_oc_inst_iitb` | Mumbai | `demo_oc_user_iyer` |
| St. Xavier's Demo College | `demo_oc_inst_xaviers` | Mumbai | `demo_oc_user_zara` |

## Linked Groups

| Group | ID | Institution | Visibility | Owner |
| --- | --- | --- | --- | --- |
| CSE Batch of 2026 | `demo_oc_group_cse_2026` | `demo_oc_inst_iitb` | private | `demo_oc_user_iyer` |
| IITB Robotics Club | `demo_oc_group_robotics` | `demo_oc_inst_iitb` | public | `demo_oc_user_aarav` |
| Campus Announcements | `demo_oc_group_announcements` | `demo_oc_inst_iitb` | public | `demo_oc_user_iyer` |
| Xavier's Debate Society | `demo_oc_group_debate` | `demo_oc_inst_xaviers` | public | `demo_oc_user_zara` |

## Feed Posts

| Post | ID | Institution | Group |
| --- | --- | --- | --- |
| Mid-semester timetable released | `demo_oc_post_iitb_exam` | `demo_oc_inst_iitb` | `demo_oc_group_announcements` |
| Robotics open lab | `demo_oc_post_robotics` | `demo_oc_inst_iitb` | `demo_oc_group_robotics` |
| Debate society trials | `demo_oc_post_debate` | `demo_oc_inst_xaviers` | `demo_oc_group_debate` |

All demo rows use `demo_oc_` IDs so `remove_demo_oncampus_institution_seed.sql` can remove them safely.
