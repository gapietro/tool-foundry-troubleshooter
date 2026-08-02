import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    'acl-audit-create': {
                        table: 'sys_security_acl'
                        id: 'e0079a9e57be467b94ac59e6ddb617b9'
                    }
                    'acl-audit-read': {
                        table: 'sys_security_acl'
                        id: '7638b54b4b3c48f4a0338091585485b6'
                    }
                    'acl-run-create': {
                        table: 'sys_security_acl'
                        id: '4dfedd8032fd4606b01702968f568fb4'
                    }
                    'acl-run-delete': {
                        table: 'sys_security_acl'
                        id: 'c4d8baab1d5c4bd59c80b7b8930e736d'
                    }
                    'acl-run-read': {
                        table: 'sys_security_acl'
                        id: 'b5ad1be2165b4e7bb682f88c140137c2'
                    }
                    'acl-run-write': {
                        table: 'sys_security_acl'
                        id: 'd9f189d4511546fdbcc03fae8da4a7dd'
                    }
                    'agent-doctor': {
                        table: 'sn_aia_agent'
                        id: 'e1392946828940e5a708fc51b0a5e954'
                    }
                    'agent-doctor-acl': {
                        table: 'sys_security_acl'
                        id: 'ef1f815d97a0431e8b87f4a055ba5b3d'
                    }
                    bom_json: {
                        table: 'sys_module'
                        id: 'cfd6e48922964e20ade700d69db34931'
                    }
                    br0: {
                        table: 'sys_script'
                        id: '85b27e4c889943a1bb30af6a98e2ab33'
                    }
                    cs0: {
                        table: 'sys_script_client'
                        id: 'af760ca041894ddd9b914b5af65cb766'
                    }
                    'pa-agent-loop': {
                        table: 'sys_script_include'
                        id: '63cde457a0a34165ab4dc227797dfd16'
                    }
                    'pa-artifact-store': {
                        table: 'sys_script_include'
                        id: 'fb2d4b7e7c794f8b956cc1a8eb3871f6'
                    }
                    'pa-audit-logger': {
                        table: 'sys_script_include'
                        id: '2fc5b74bb9f4425b846022e1572ed294'
                    }
                    'pa-fix-report': {
                        table: 'sys_script_include'
                        id: '02e215b1cf424baeb7f13a3fd5145ae3'
                    }
                    'pa-llm-input-prompt': {
                        table: 'sys_one_extend_definition_attribute'
                        id: 'd045f44fadb4411c94d114edc67c7218'
                        deleted: true
                    }
                    'pa-llm-proxy': {
                        table: 'sys_script_include'
                        id: 'ed5c865ceab74581af9040b28c9e86b2'
                    }
                    'pa-llm-reason-acl': {
                        table: 'sys_security_acl'
                        id: '4db071a71082415f9de11a602563bd52'
                    }
                    'pa-llm-reason-input-prompt': {
                        table: 'sys_one_extend_definition_attribute'
                        id: 'a01dd1b1883345fb9e8592c82bb6d44a'
                    }
                    'pa-llm-reason-prompt-v1': {
                        table: 'sys_generative_ai_config'
                        id: '6c8d17638d8542b7b60962ddc9e167f2'
                    }
                    'pa-llm-reason-skill': {
                        table: 'sys_one_extend_capability'
                        id: '0bf0bc13a7414399a1482d21de01231d'
                    }
                    'pa-llm-reason-skill__output_error': {
                        table: 'sys_one_extend_definition_attribute'
                        id: '80ed34fbd6b14019aab030a05d27da34'
                    }
                    'pa-llm-reason-skill__output_errorcode': {
                        table: 'sys_one_extend_definition_attribute'
                        id: '427fa2cadf5d410ab407e5ecd5b8e4c7'
                    }
                    'pa-llm-reason-skill__output_provider': {
                        table: 'sys_one_extend_definition_attribute'
                        id: '2b8a6dbe2faf4dcaa404966fe1a7a1f4'
                    }
                    'pa-llm-reason-skill__output_response': {
                        table: 'sys_one_extend_definition_attribute'
                        id: 'f6b63872e08c48738b48aa46d59561ae'
                    }
                    'pa-llm-reason-skill__output_status': {
                        table: 'sys_one_extend_definition_attribute'
                        id: '1ecbfcf87fd44f4087a7143b3a2dc396'
                    }
                    'pa-llm-summarize-acl': {
                        table: 'sys_security_acl'
                        id: 'ac36c7a2cb58451a8a5111ab3adcf457'
                    }
                    'pa-llm-summarize-input-prompt': {
                        table: 'sys_one_extend_definition_attribute'
                        id: '13f74a6b0ed04aa0bfd5a5cf19dd259b'
                    }
                    'pa-llm-summarize-prompt-v1': {
                        table: 'sys_generative_ai_config'
                        id: '57b76b4affc54a3583cb62ecbd4445df'
                    }
                    'pa-llm-summarize-skill': {
                        table: 'sys_one_extend_capability'
                        id: '3914d62f6a9b42a3a4633432a97a1d0f'
                    }
                    'pa-llm-summarize-skill__output_error': {
                        table: 'sys_one_extend_definition_attribute'
                        id: '433812bcaedb49cb97b081d9aa199f7d'
                    }
                    'pa-llm-summarize-skill__output_errorcode': {
                        table: 'sys_one_extend_definition_attribute'
                        id: '86f32138797a4a77bb5b52430c6ed795'
                    }
                    'pa-llm-summarize-skill__output_provider': {
                        table: 'sys_one_extend_definition_attribute'
                        id: '52b05d0a76d64d349708e9ef9af42a0f'
                    }
                    'pa-llm-summarize-skill__output_response': {
                        table: 'sys_one_extend_definition_attribute'
                        id: '86515df8a4c04686bc60689c1e5725e7'
                    }
                    'pa-llm-summarize-skill__output_status': {
                        table: 'sys_one_extend_definition_attribute'
                        id: 'f657ed16599b48a7a6ffc8301e18bf01'
                    }
                    'pa-rest-handlers': {
                        table: 'sys_script_include'
                        id: 'bb56fbba83d6439a9a786dbbffcde463'
                    }
                    'pa-run-anchor': {
                        table: 'sys_script_include'
                        id: '442109ddbf1c459d919c2b04ffa9e71f'
                    }
                    'pa-run-manager': {
                        table: 'sys_script_include'
                        id: 'fa5ff2c04df6474ea45b8d909133bb5d'
                    }
                    'pa-script-tool-adapter': {
                        table: 'sys_script_include'
                        id: '8adcc81877fb40be96f1422c18682b5b'
                    }
                    'pa-tool-agent-config': {
                        table: 'sys_script_include'
                        id: '47a854bd8a684dfb829eb5c5f5129b33'
                    }
                    'pa-tool-agent-trace': {
                        table: 'sys_script_include'
                        id: 'e460c4021e4b44dcaf92570057d5a360'
                    }
                    'pa-tool-genai-log': {
                        table: 'sys_script_include'
                        id: 'ad804b6ddf49450395f1f2cb395dc0bb'
                    }
                    'pa-tool-log-analysis': {
                        table: 'sys_script_include'
                        id: '39393c823f914812ac23046b488ac716'
                    }
                    'pa-tool-query-table': {
                        table: 'sys_script_include'
                        id: '61dfed511b834b9f9fb2947f762e93c6'
                    }
                    'pa-tool-read-artifact': {
                        table: 'sys_script_include'
                        id: '3979cce296d748edac6f85de1d9136a5'
                    }
                    'pa-tool-read-kit': {
                        table: 'sys_script_include'
                        id: 'a1dabd22816640edbcc43b3d87422997'
                    }
                    'pa-tool-registry': {
                        table: 'sys_script_include'
                        id: '4971ec9e558d4c5695103c5726c546ee'
                    }
                    'pa-tool-schema-lookup': {
                        table: 'sys_script_include'
                        id: '7637530d904841498691b27cd923c90e'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '296e46a72ad14ef5a7f123411966e86e'
                    }
                    'run-start-event': {
                        table: 'sysevent_register'
                        id: '0d32b2c4557446f09def2634cd9342f6'
                    }
                    'run-start-worker': {
                        table: 'sysevent_script_action'
                        id: '0e5d43bca3a64ecba031985a7d1c7559'
                    }
                    'scope-probe-adapter': {
                        table: 'sys_ws_operation'
                        id: '41e02cdf0a3f40aba13d2e4f4a71178a'
                        deleted: true
                    }
                    'scope-probe-anchor-selftest': {
                        table: 'sys_ws_operation'
                        id: '89ad8ce31da841608b1514bc1644b3a7'
                        deleted: true
                    }
                    'scope-probe-api': {
                        table: 'sys_ws_definition'
                        id: '29747bd00742435e8884e7311ef6a7df'
                    }
                    'scope-probe-artifact-selftest': {
                        table: 'sys_ws_operation'
                        id: '1fc74db242f84cc79c489e4a72c6ec35'
                        deleted: true
                    }
                    'scope-probe-derisk': {
                        table: 'sys_ws_operation'
                        id: '623d8fc33dba474590b18daf77cb0685'
                        deleted: true
                    }
                    'scope-probe-reads': {
                        table: 'sys_ws_operation'
                        id: 'a04ccacf0888461d84eb46c0e0d14752'
                    }
                    'scope-probe-trace': {
                        table: 'sys_ws_operation'
                        id: '074e8ea6df954aeb9a92cc93f586b790'
                        deleted: true
                    }
                    'scope-probe-v1': {
                        table: 'sys_ws_version'
                        id: '75b650020ec04fd8a583813797f4e91c'
                    }
                    'src_server_async_sweep-stale-runs_js': {
                        table: 'sys_module'
                        id: 'e0fe3faf665743c4ac95cc3b6116e93b'
                    }
                    src_server_PaAgentLoop_js: {
                        table: 'sys_module'
                        id: 'd3e4c8fa744e4a40bdabc6ffd4019363'
                    }
                    src_server_PaArtifactStore_js: {
                        table: 'sys_module'
                        id: 'c3643d5da7cd404581a5fc2116ee5661'
                    }
                    src_server_PaAuditLogger_js: {
                        table: 'sys_module'
                        id: 'c858e2de4e114366a52544c1f671af59'
                    }
                    src_server_PaFixReport_js: {
                        table: 'sys_module'
                        id: 'fe97ff415ce04e2c9175a7b9c3f218db'
                    }
                    src_server_PaLlmProxy_js: {
                        table: 'sys_module'
                        id: 'd894b2b8ac994e1c8c41330b40b51d8a'
                    }
                    src_server_PaRunAnchor_js: {
                        table: 'sys_module'
                        id: 'bb0b6de06e71450e9fbeec1f74f4fa3f'
                    }
                    src_server_PaRunManager_js: {
                        table: 'sys_module'
                        id: 'e2de7d6c839543c387a01c576b58b2dd'
                    }
                    src_server_PaScriptToolAdapter_js: {
                        table: 'sys_module'
                        id: '5a54685b6fd04426acc3bb39714b0f4f'
                    }
                    src_server_PaToolReadKit_js: {
                        table: 'sys_module'
                        id: 'b77434ce374d497d8337ca6c0484c564'
                    }
                    src_server_PaToolRegistry_js: {
                        table: 'sys_module'
                        id: '1cdeb056ba2a4c33ac23685fdfefbcdb'
                    }
                    src_server_rest_PaRestHandlers_js: {
                        table: 'sys_module'
                        id: '6408eb2d707249398414e5da462ac24d'
                    }
                    src_server_script_ts: {
                        table: 'sys_module'
                        id: 'd8226c63fd0d44bea250580a81a4424c'
                    }
                    src_server_tools_PaToolAgentConfig_js: {
                        table: 'sys_module'
                        id: 'b4b6eedfa3494d7b89ad2211c8b1e221'
                    }
                    src_server_tools_PaToolAgentTrace_js: {
                        table: 'sys_module'
                        id: 'cae852b254fc45a8ac5bd32c712102be'
                    }
                    src_server_tools_PaToolGenAiLog_js: {
                        table: 'sys_module'
                        id: 'be8964c645b44148bc5ab79b5c8c38bc'
                    }
                    src_server_tools_PaToolLogAnalysis_js: {
                        table: 'sys_module'
                        id: 'e0e182c31d0540fd9efa5d5b28eee0dc'
                    }
                    src_server_tools_PaToolQueryTable_js: {
                        table: 'sys_module'
                        id: 'f383c16aa9c44ccbb8171b789064766b'
                    }
                    src_server_tools_PaToolReadArtifact_js: {
                        table: 'sys_module'
                        id: '023a0738182045e3aedaecd5ea2478f3'
                    }
                    src_server_tools_PaToolSchemaLookup_js: {
                        table: 'sys_module'
                        id: '604cba00d49c43589337e55b3552f19a'
                    }
                    'stale-run-sweep': {
                        table: 'sysauto_script'
                        id: '6121cda46e784c16a2572c8a941e315c'
                    }
                    'troubleshooter-api': {
                        table: 'sys_ws_definition'
                        id: '4c8c96efa69c494db3b5856c10cd2c01'
                    }
                    'troubleshooter-api-v1': {
                        table: 'sys_ws_version'
                        id: '7033cfc6657e469587981dec3829b83e'
                    }
                    'troubleshooter-param-get-run-id': {
                        table: 'sys_ws_query_parameter'
                        id: 'c34e2406b9304346878e80d48ce7f8eb'
                    }
                    'troubleshooter-param-message-run-id': {
                        table: 'sys_ws_query_parameter'
                        id: '1ed0981679814f4e91b00d21abad10a6'
                    }
                    'troubleshooter-route-analyze': {
                        table: 'sys_ws_operation'
                        id: '2dfdea5c21c94f618239d50317e8f8e2'
                    }
                    'troubleshooter-route-get-run': {
                        table: 'sys_ws_operation'
                        id: 'f08a2179378041a288e8e4c859cbd346'
                    }
                    'troubleshooter-route-message': {
                        table: 'sys_ws_operation'
                        id: '7dcee59300d04fef95bb1850f33d1b22'
                    }
                    'troubleshooter-route-status': {
                        table: 'sys_ws_operation'
                        id: 'dc54175c37cd417fb84b44870d45e8a7'
                    }
                    'troubleshooter-route-tools': {
                        table: 'sys_ws_operation'
                        id: '923fc0c586fe4844ae7457cfe7e07589'
                    }
                    'xsp-syslog-read': {
                        table: 'sys_scope_privilege'
                        id: '8b8a75b6d0fe4826b54854d2c38202a1'
                    }
                }
                composite: [
                    {
                        table: 'sys_choice_set'
                        id: '0131cdbf57a04331ba142c6716e8fd66'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'harness'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: '0154a35691fd416a8364bcab414fd5a9'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                            tool: '387983889a1845e8ac55829bef5b238e'
                            name: 'agent_trace'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '04afae7468e4448c9cdac78ccad6155b'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            value: 'queued'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '08ed366a6f0d4faf9a3f3299c582de24'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'run'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '0994f4a0115d478fbdc7b47f91254e48'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'target_table'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '0a04be84c4094640b0306c4b24c18c0e'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'mode'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '0fccd2ef201f48cc83f7c7f45e3e0d47'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'mode'
                            value: 'diagnose'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '108e12b3b9dd412bb70080dbd402d80f'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'target_record'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '10f1be2b7d0f430c9fd090f53085f8e4'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'target_table'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '16e086f1163344d6a85201a5eb2b1402'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'user'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '17db68e8acae422f8359af0898ed4a1e'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'tool_name'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: '18127b03d2da4c4cb05bbff4e458df19'
                        key: {
                            name: 'agent_config'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '1897483989964a4e9b1c201a2e4d6510'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'output'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '1b2bcc9306a44d3798373e7315fc5589'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'mode'
                            language: 'en'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '1b51f2ab0150458f92ce7a480768421c'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                        }
                    },
                    {
                        table: 'sn_nowassist_skill_config'
                        id: '21c00b55a323477082b23a25049a11ba'
                        key: {
                            skill_id: '0bf0bc13a7414399a1482d21de01231d'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '23796a4558eb4d2993c74f4739c5780b'
                        key: {
                            sys_security_acl: '7638b54b4b3c48f4a0338091585485b6'
                            sys_user_role: {
                                id: '8c13403abda74dcb9964e5962f58d64a'
                                key: {
                                    name: 'x_snc_troubleshoot.user'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_gen_ai_strategy_mapping'
                        id: '2af33e9afead4e2084ef066de9a4f37d'
                        key: {
                            strategy: 'CAPABILITY_EXECUTION'
                            feature: {
                                id: '32880fd465f74ca9a1b2e18a0ed38921'
                                key: {
                                    feature_name: 'pa llm summarize'
                                    document: '3914d62f6a9b42a3a4633432a97a1d0f'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '2c2275e6cbab48839dadfaf7babbbb4d'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'mode'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '2c79075668814bd4ac3e9d49e3398274'
                        key: {
                            sys_security_acl: '7638b54b4b3c48f4a0338091585485b6'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_one_extend_resource_mapping'
                        id: '2d9cabae0a004601824029360c270e6e'
                        key: {
                            parent_capability: '3914d62f6a9b42a3a4633432a97a1d0f'
                            resource_capability: '3914d62f6a9b42a3a4633432a97a1d0f'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '2f3bb55bc44b44bb9caf2531b747c398'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'confirmed_by_user'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '30e39ab94fbc4d25ae5d0af0e7b372d1'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'error'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '318421a325064300976fb6db3dc504e2'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                        }
                    },
                    {
                        table: 'sys_gen_ai_feature_mapping'
                        id: '32880fd465f74ca9a1b2e18a0ed38921'
                        key: {
                            feature_name: 'pa llm summarize'
                            document: '3914d62f6a9b42a3a4633432a97a1d0f'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: '34149445e94b46668374caa8061b6a78'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                            tool: 'dce4f5cdd48f4fe89121b7760d4bf563'
                            name: 'log_analysis'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '355e171426154b1c96417e39e8867ff5'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'number'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '35ec448bf4d04ce9887d422248d63b05'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'transcript'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_one_extend_definition_config'
                        id: '3607b2b4596c472987319c95eede5d41'
                        key: {
                            definition: {
                                id: '620255db6d8e4ef9999dd087e20844a7'
                                key: {
                                    capability: '0bf0bc13a7414399a1482d21de01231d'
                                    api: '936e514a53b3b110f028ddeeff7b128c'
                                }
                            }
                            capability: '0bf0bc13a7414399a1482d21de01231d'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: '387983889a1845e8ac55829bef5b238e'
                        key: {
                            name: 'agent_trace'
                        }
                    },
                    {
                        table: 'sn_nowassist_skill_config'
                        id: '3997e152586a4c8986ebe6d9e6bb6120'
                        key: {
                            skill_id: '3914d62f6a9b42a3a4633432a97a1d0f'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '3faf6ce2337f4a788e65d7775f455c59'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '403c548d45744a5ba338f8c94498c846'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            value: 'awaiting_confirmation'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '42df543a92014e3d990882228ada7b37'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'number'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '43decf18ea994543a6a20665ce3019a4'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'input'
                            language: 'en'
                        }
                    },
                    {
                        table: 'ua_table_licensing_config'
                        id: '43ebe4750f814df2ad0b015099662199'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                        }
                    },
                    {
                        table: 'sn_aia_agent_config'
                        id: '4874f8bc13c94fa9a70dae46abc8ba1e'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '49d6897bf9634285b0b16b5ecc563fcb'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            value: 'running'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '4c5f3341253f421b858515ee09681978'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '5031f75b5db84bb688f5f32efc87b300'
                        key: {
                            sys_security_acl: 'b5ad1be2165b4e7bb682f88c140137c2'
                            sys_user_role: {
                                id: '8c13403abda74dcb9964e5962f58d64a'
                                key: {
                                    name: 'x_snc_troubleshoot.user'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '5119101ad8164717b5598da0a5bbed95'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                            value: 'result'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5489cc6ce32a41c28b9ca5dd93b6f3d7'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'error'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '560af908094241e6861ec7b6b2ef5131'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            value: 'failed'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: '5807dcaeb6ea48179f034181dc13a16f'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                            tool: '9cbf6011abf04716b016851e39c56443'
                            name: 'schema_lookup'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5a0deab2cb8d4dcb8e1d23b08bef978b'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'confirmed_by_user'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '5dc93bd2dbca430c8890c6ff86a68674'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'input'
                        }
                    },
                    {
                        table: 'sys_gen_ai_strategy_mapping'
                        id: '5f47a169fbf04ffd834d1600985e7e24'
                        key: {
                            strategy: 'CAPABILITY_EXECUTION'
                            feature: {
                                id: 'ce70f923528c4844a643aa417cc7c7f3'
                                key: {
                                    feature_name: 'pa llm reason'
                                    document: '0bf0bc13a7414399a1482d21de01231d'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_one_extend_capability_definition'
                        id: '620255db6d8e4ef9999dd087e20844a7'
                        key: {
                            capability: '0bf0bc13a7414399a1482d21de01231d'
                            api: '936e514a53b3b110f028ddeeff7b128c'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '6271a9fc390a4edaa4c7c7690c4f926f'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                            value: 'error'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_one_extend_definition_config'
                        id: '671b6c8d99c649d7a50287cc57886d4e'
                        key: {
                            definition: {
                                id: 'f24a39cd0b384eacb4649387d7f41531'
                                key: {
                                    capability: '3914d62f6a9b42a3a4633432a97a1d0f'
                                    api: '936e514a53b3b110f028ddeeff7b128c'
                                }
                            }
                            capability: '3914d62f6a9b42a3a4633432a97a1d0f'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '6c98730db77a48cfb9432b48dbc4c08d'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'output'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: '6d724f5caf744f2299900f047acd4a10'
                        key: {
                            name: 'query_table'
                        }
                    },
                    {
                        table: 'sys_choice_set'
                        id: '6e1aabb23d1b44bd884e95f10bad970a'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '703209d664514cdfa8e685ae4217ef3c'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'run'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '738906ad7f7e4d7285321ebda9af58ab'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'transcript'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '77c616ea549b4ed9b7c3bdaf11001bdd'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'fix_report'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_agent_access_role_mapping'
                        id: '77edd97f4b304ac8b8f634368f50280f'
                        key: {
                            agent_access_config: {
                                id: 'd76dd00253b64abda09c0ffed4116663'
                                key: {
                                    agent: '21c00b55a323477082b23a25049a11ba'
                                }
                            }
                            role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '7b8cf0b5c1d741d59eaee936fd91150f'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'tool_name'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_generative_ai_prompt_config'
                        id: '808a4a3f72eb42c89e2b034460175756'
                        key: {
                            ai_config: '57b76b4affc54a3583cb62ecbd4445df'
                        }
                    },
                    {
                        table: 'sys_generative_ai_prompt_config'
                        id: '819a1e521bfc41cabc0fb1f414360e32'
                        key: {
                            ai_config: '6c8d17638d8542b7b60962ddc9e167f2'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '81c9bd86ba584862bb3e214e45c5d712'
                        key: {
                            sys_security_acl: 'b5ad1be2165b4e7bb682f88c140137c2'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8414aa1467904d62848363f0bcf410ed'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'fix_report'
                        }
                    },
                    {
                        table: 'sn_nowassist_skill_config_status'
                        id: '88ea3fc615a34363a57da0207b1daf2d'
                        key: {
                            skill_config: {
                                id: '3997e152586a4c8986ebe6d9e6bb6120'
                                key: {
                                    skill_id: '3914d62f6a9b42a3a4633432a97a1d0f'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '89954005f8604ae4b31fd7fcc8668cf6'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'context_summary'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '89d4a576922f440a8d05def05fe22190'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'target_record'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '8a3200d5b9b244ba904f077116d7efd8'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'harness'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8ae0768176ad4e0787db4ed54c62ac99'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'user'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8be57946d83748fc9dd920b38a1e2b0e'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'agent'
                        }
                    },
                    {
                        table: 'sys_user_role'
                        id: '8c13403abda74dcb9964e5962f58d64a'
                        key: {
                            name: 'x_snc_troubleshoot.user'
                        }
                    },
                    {
                        table: 'sys_ws_query_parameter_map'
                        id: '8c257819820c4feda4201778f4159092'
                        key: {
                            web_service_operation: '7dcee59300d04fef95bb1850f33d1b22'
                            web_service_query_parameter: '1ed0981679814f4e91b00d21abad10a6'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: '8f0b2570c0b54f74af0c194bd2ec4e87'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'conversation_ref'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '8f969afae83946029a0d4359176869d5'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            value: 'complete'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: '8f9ab816e01a4f8080c169869a84c410'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'NULL'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '8fbd80e03b1d4d6c80f69db5b94823c2'
                        key: {
                            sys_security_acl: 'd9f189d4511546fdbcc03fae8da4a7dd'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: '95fcfca298b2443a8258a77447c887a3'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                            value: 'intent'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: '97720609c89c47d1ad21efd3a867f1f2'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                            tool: '6d724f5caf744f2299900f047acd4a10'
                            name: 'query_table'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: '9a9d4d2631ab4bc480ed3bd2c872f24f'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                            tool: 'b6d9ddff9c9945dcaaac27ff25aa9c4f'
                            name: 'genai_log'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: '9cbf6011abf04716b016851e39c56443'
                        key: {
                            name: 'schema_lookup'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: '9fb95833fdb24cfcaaad91cf0d756330'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                            tool: 'a0716c5ad77f42c29e1420b7f9009bda'
                            name: 'read_artifact'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: 'a0716c5ad77f42c29e1420b7f9009bda'
                        key: {
                            name: 'read_artifact'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'a21fd9a9cbe34fffb0160f84de1768f1'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'execution_ref'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'aac207cd6fe442b1bb882cddc594d962'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'ac186115560d4319a2b05d8f427ffbb9'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'harness'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'ae07caaf5a9946dfa518054480f173a0'
                        key: {
                            sys_security_acl: 'c4d8baab1d5c4bd59c80b7b8930e736d'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_number'
                        id: 'afcf5dd885ae4a0095ab49e7aa20db5e'
                        key: {
                            category: 'x_snc_troubleshoot_run'
                            prefix: 'TR'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'b0b454d071d7469a9cc5207434bddac9'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'execution_ref'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: 'b69939bf9e8347aaba5568b133765d6d'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: 'b6d9ddff9c9945dcaaac27ff25aa9c4f'
                        key: {
                            name: 'genai_log'
                        }
                    },
                    {
                        table: 'sys_agent_access_role_configuration'
                        id: 'bc9c716b0afe4376a6d748afa2847aef'
                        key: {
                            agent: '3997e152586a4c8986ebe6d9e6bb6120'
                        }
                    },
                    {
                        table: 'sn_aia_agent_tool_m2m'
                        id: 'c2c28b3942b6479692cd2e9e69a9de26'
                        key: {
                            agent: 'e1392946828940e5a708fc51b0a5e954'
                            tool: '18127b03d2da4c4cb05bbff4e458df19'
                            name: 'agent_config'
                        }
                    },
                    {
                        table: 'sys_user_role'
                        id: 'c3c9f3a9863249f08abc0e7d01cba643'
                        key: {
                            name: 'x_snc_troubleshoot.admin'
                        }
                    },
                    {
                        table: 'sys_gen_ai_feature_mapping'
                        id: 'ce70f923528c4844a643aa417cc7c7f3'
                        key: {
                            feature_name: 'pa llm reason'
                            document: '0bf0bc13a7414399a1482d21de01231d'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'd311b03651b049aebadf6c3df8171f9e'
                        key: {
                            sys_security_acl: 'e0079a9e57be467b94ac59e6ddb617b9'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'd438363362a44ebdbf29e980286b246e'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'd63fa9816f114c11b6fcec45a0e776ea'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'harness'
                            value: 'native'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_agent_access_role_configuration'
                        id: 'd76dd00253b64abda09c0ffed4116663'
                        key: {
                            agent: '21c00b55a323477082b23a25049a11ba'
                        }
                    },
                    {
                        table: 'sn_aia_tool'
                        id: 'dce4f5cdd48f4fe89121b7760d4bf563'
                        key: {
                            name: 'log_analysis'
                        }
                    },
                    {
                        table: 'sys_agent_access_role_mapping'
                        id: 'dd124f8b890a495dbf70a7ec260f3fc9'
                        key: {
                            agent_access_config: {
                                id: 'bc9c716b0afe4376a6d748afa2847aef'
                                key: {
                                    agent: '3997e152586a4c8986ebe6d9e6bb6120'
                                }
                            }
                            role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sn_nowassist_skill_config_status'
                        id: 'dd71fa7c889a40d3bc5008ebab6ffa12'
                        key: {
                            skill_config: {
                                id: '21c00b55a323477082b23a25049a11ba'
                                key: {
                                    skill_id: '0bf0bc13a7414399a1482d21de01231d'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_ws_query_parameter_map'
                        id: 'dda23265e76044a9adfa70fb47e4a741'
                        key: {
                            web_service_operation: 'f08a2179378041a288e8e4c859cbd346'
                            web_service_query_parameter: 'c34e2406b9304346878e80d48ce7f8eb'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'e14289f28bcf4edb9e4fc876d0b3c4fc'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'NULL'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'e15b8c3a42944b678f5befc7b85dcd58'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'harness'
                            value: 'custom'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: 'e2be7dd3c3ce45df961444fab8a50c51'
                        key: {
                            sys_security_acl: '4dfedd8032fd4606b01702968f568fb4'
                            sys_user_role: {
                                id: 'c3c9f3a9863249f08abc0e7d01cba643'
                                key: {
                                    name: 'x_snc_troubleshoot.admin'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e2c4dac7730949adb18751b6b0e7487e'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'status'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e2cd0012ec8849bebcaf68b35053386c'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'user'
                        }
                    },
                    {
                        table: 'sys_db_object'
                        id: 'e2ce17478fe24fd1968337f74e7bf353'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'e37aa4ab5dee46c3863288b72969412d'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'context_summary'
                        }
                    },
                    {
                        table: 'sn_aia_version'
                        id: 'e710ed445e8b42409684b1d1b50b3cee'
                        key: {
                            target_id: 'e1392946828940e5a708fc51b0a5e954'
                            version_name: 'V1'
                        }
                    },
                    {
                        table: 'sys_dictionary'
                        id: 'ead6c0650cdc47a8be5306011ecc031d'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'conversation_ref'
                        }
                    },
                    {
                        table: 'sys_one_extend_capability_definition'
                        id: 'f24a39cd0b384eacb4649387d7f41531'
                        key: {
                            capability: '3914d62f6a9b42a3a4633432a97a1d0f'
                            api: '936e514a53b3b110f028ddeeff7b128c'
                        }
                    },
                    {
                        table: 'sys_choice'
                        id: 'f4d97983a6d84bb9a1635ec29dd579a6'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'mode'
                            value: 'collect'
                            language: 'en'
                            dependent_value: 'NULL'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f5756710075a469a94542cc0b3fae664'
                        key: {
                            name: 'x_snc_troubleshoot_run'
                            element: 'agent'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'f7091ca902484dc39137810f2a7774e3'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'user'
                            language: 'en'
                        }
                    },
                    {
                        table: 'sys_one_extend_resource_mapping'
                        id: 'f9483fe7a99d4cce960a4177815e1936'
                        key: {
                            parent_capability: '0bf0bc13a7414399a1482d21de01231d'
                            resource_capability: '0bf0bc13a7414399a1482d21de01231d'
                        }
                    },
                    {
                        table: 'sys_documentation'
                        id: 'fe2f89d952ab42dfbb3189862796f316'
                        key: {
                            name: 'x_snc_troubleshoot_audit'
                            element: 'action_type'
                            language: 'en'
                        }
                    },
                ]
            }
        }
    }
}
