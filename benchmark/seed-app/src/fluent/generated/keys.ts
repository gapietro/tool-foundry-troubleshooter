import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    bom_json: {
                        table: 'sys_module'
                        id: 'ad714b275f324ba79ba057c420861e08'
                    }
                    br0: {
                        table: 'sys_script'
                        id: '74432594faa840ef98ffbe85e2168cc5'
                        deleted: true
                    }
                    cs0: {
                        table: 'sys_script_client'
                        id: '03317942948949a1b8adfec10ad60843'
                        deleted: true
                    }
                    package_json: {
                        table: 'sys_module'
                        id: 'ad7f8559341f4c86bc9db1ecf47441a9'
                    }
                    'seed-01-acl': {
                        table: 'sys_security_acl'
                        id: 'ad85ae36a766464783467b54ad484e0d'
                    }
                    'seed-01-agent': {
                        table: 'sn_aia_agent'
                        id: '914db68f3e364222a47f9e5398b6ac8d'
                    }
                    'seed-02-acl': {
                        table: 'sys_security_acl'
                        id: 'f269efa6926c43ce8f8a9803f7040a6a'
                    }
                    'seed-02-agent': {
                        table: 'sn_aia_agent'
                        id: 'cd050d48e810411d9f113fd530694fe6'
                    }
                    'seed-03-acl': {
                        table: 'sys_security_acl'
                        id: '8a702855bc0b437eb9e65e0c30cad74d'
                    }
                    'seed-03-agent': {
                        table: 'sn_aia_agent'
                        id: '0bbf1b00cce848838cc675986233120b'
                    }
                    src_server_script_ts: {
                        table: 'sys_module'
                        id: '30055670e07444bd993faecf66d51bc8'
                    }
                }
                composite: [
                    {
                        table: 'sn_aia_agent_config'
                        id: '0434d97b6fb84307ba54774a0a161df6'
                        key: {
                            agent: '0bbf1b00cce848838cc675986233120b'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '135eceb3092741ce8b4c008a2c367ab5'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'priority'
                            value: '1'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '18614c6e7b2146dea8a565cc6674f450'
                        key: {
                            name: 'x_snc_tsbench_routing'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: '1fa91a286055441bb4afce79fe876207'
                        key: {
                            agent: '914db68f3e364222a47f9e5398b6ac8d'
                            tool: '8953483c2762479b97bf55da8ed1c4ac'
                            name: 'set_ticket_priority'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '2090699541044a81a248df5f25ec22c8'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'short_description'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '351ae5edc98d437b846b693c4ba6203f'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: '3bacb3ef18454586b86a87f11ffaae9a'
                        key: {
                            agent: '0bbf1b00cce848838cc675986233120b'
                            tool: '3bd31a0be63d4e81856598dbd2c96788'
                            name: 'lookup_routing_rule'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: '3bd31a0be63d4e81856598dbd2c96788'
                        key: {
                            name: 'lookup_routing_rule'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '3e80ddd1515f448689d7e968214df260'
                        key: {
                            name: 'x_snc_tsbench_routing'
                            element: 'assignment_group'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '4356ad8ccf914f86a86e819f6979a783'
                        key: {
                            name: 'x_snc_tsbench_routing'
                            element: 'category'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '4de2781d8d274cf796721b1ace0396da'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'priority'
                            value: '3'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '4f36ff83dd024369a9ca241ada73fc90'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'short_description'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: '5e789b25ca3844f984e662bb2bc8dc97'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '670d055fdc424b4c945c712772a5c065'
                        key: {
                            name: 'x_snc_tsbench_routing'
                        }
                    },
                    {
                        table: 'sn_aia_version'
                        id: '6df8348de94a40869de668d409733c21'
                        key: {
                            target_id: '0bbf1b00cce848838cc675986233120b'
                            version_name: 'V1'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '76c1e6d91ed547dc911fdcf4fdaaa2ba'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '836b623ac1d94e14a8a06d965958de1c'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'escalation_count'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '84e58650cd334658bb0521bd693a0f6e'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'priority'
                            value: '5'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: '8953483c2762479b97bf55da8ed1c4ac'
                        key: {
                            name: 'set_ticket_priority'
                        }
                    },
                    {
                        table: 'sn_aia_version'
                        id: '8ef2290dfd3141f193438d4d018cc793'
                        key: {
                            target_id: 'cd050d48e810411d9f113fd530694fe6'
                            version_name: 'V1'
                        }
                    },
                    {
                        table: 'sn_aia_agent_config'
                        id: '9a349970fea24e6791aaec190cbc4d31'
                        key: {
                            agent: 'cd050d48e810411d9f113fd530694fe6'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: 'ab1d0461b19342f8a3a7755e68c9936a'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'priority'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'ad87e67c7b934f9fb256425350fac831'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'priority'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sn_aia_version'
                        id: 'b10a90822bc1410490cd71b269725995'
                        key: {
                            target_id: '914db68f3e364222a47f9e5398b6ac8d'
                            version_name: 'V1'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'b3c3b9f09c974e5692d3c51083cc518b'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'escalation_count'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'b86345a024a74404bf7c1f12c0fdb770'
                        key: {
                            name: 'x_snc_tsbench_routing'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'cbc6be9077c244bfb29f245e38309f66'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'priority'
                            value: '4'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'd44c60c42ac14b2eb8d896cc35272b6b'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'priority'
                            value: '2'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sn_aia_agent_config'
                        id: 'db3ac7f437c14c9fb25b00492d0a1818'
                        key: {
                            agent: '914db68f3e364222a47f9e5398b6ac8d'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e066ceb473a24de497d8236c4e3a28b8'
                        key: {
                            name: 'x_snc_tsbench_routing'
                            element: 'assignment_group'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: 'ece2b203c073475e89ffad8a360bb204'
                        key: {
                            name: 'x_snc_tsbench_routing'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'f91036f185534394b7bd86696994d5c7'
                        key: {
                            name: 'x_snc_tsbench_routing'
                            element: 'category'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'ff2e5b5f0cc04d88aabbc55e5c76bbb5'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'priority'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'ffabb60525014a228d0b95d03975e002'
                        key: {
                            name: 'x_snc_tsbench_ticket'
                            element: 'NULL'
                        }
                    },
                ]
            }
        }
    }
}
