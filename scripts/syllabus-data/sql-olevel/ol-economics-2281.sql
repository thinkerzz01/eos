-- Economics (2281) - Cambridge O Level outline with objectives, loaded into O1 + O2.

DO $$
DECLARE v_org uuid; v_subject uuid; v_tpl uuid;
BEGIN
  SELECT id, org_id INTO v_subject, v_org FROM public.subjects
    WHERE program='O Level (O1)' AND name='Economics' AND deleted_at IS NULL LIMIT 1;
  IF v_subject IS NULL THEN RAISE NOTICE 'Economics O Level (O1) not found - skipped'; RETURN; END IF;
  SELECT id INTO v_tpl FROM public.syllabus_templates
    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_tpl IS NULL THEN
    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)
      VALUES(v_org,v_subject,'2026','2281','active') RETURNING id INTO v_tpl;
  ELSE
    UPDATE public.syllabus_templates SET academic_year='2026', cambridge_code='2281', updated_at=now() WHERE id=v_tpl;
    UPDATE public.syllabus_subtopics SET deleted_at=now()
      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);
    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;
  END IF;
  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES
    (v_org,v_tpl,'1','The basic economic problem',0),
    (v_org,v_tpl,'2','The allocation of resources',1),
    (v_org,v_tpl,'3','Microeconomic decision makers',2),
    (v_org,v_tpl,'4','Government and the macroeconomy',3),
    (v_org,v_tpl,'5','Economic development',4),
    (v_org,v_tpl,'6','International trade and globalisation',5);
  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)
  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES
    ('1','1.1','The nature of the economic problem','["Topic", "1.1.1 finite resources and unlimited wants", "1.1.2 economic and free goods"]'::jsonb,0),
    ('1','1.2','The factors of production','["Topic", "1.2.1 definitions of the factors of production and their rewards", "1.2.2 mobility of the factors of production", "1.2.3 quantity and quality of the factors of production"]'::jsonb,1),
    ('1','1.3','Opportunity cost','["Topic", "1.3.1 definition of opportunity cost", "1.3.2 the influence of opportunity cost on decision making"]'::jsonb,2),
    ('1','1.4','Production possibility curve (PPC) diagrams','["Topic", "1.4.1 definition of PPC", "1.4.2 points under, on and beyond a PPC", "1.4.3 movements along a PPC 1.4.4 shifts in a PPC"]'::jsonb,3),
    ('2','2.1','Microeconomics and macroeconomics','["Topic", "2.1.1 microeconomics 2.1.2 macroeconomics"]'::jsonb,0),
    ('2','2.2','The role of markets in allocating resources','["Topic", "2.2.1 the market system", "2.2.2 key resources allocation decisions", "2.2.3 introduction to the price mechanism"]'::jsonb,1),
    ('2','2.3','Demand','["Topic", "2.3.1 definition of demand", "2.3.2 price, demand and quantity", "2.3.3 individual and market demand", "2.3.4 conditions of demand"]'::jsonb,2),
    ('2','2.4','Supply','["Topic", "2.4.1 definition of supply", "2.4.2 price, supply and quantity", "2.4.3 individual and market supply", "2.4.4 conditions of supply"]'::jsonb,3),
    ('2','2.5','Price determination','["Topic", "2.5.1 market equilibrium", "2.5.2 market disequilibrium"]'::jsonb,4),
    ('2','2.6','Price changes','["Topic", "2.6.1 causes of price changes", "2.6.2 consequences of price changes"]'::jsonb,5),
    ('2','2.7','Price elasticity of demand (PED)','["Topic", "2.7.1 definition of PED 2.7.2 calculation of PED", "2.7.3 determinants of PED", "2.7.4 PED and total spending on a product/ revenue", "2.7.5 significance of PED"]'::jsonb,6),
    ('2','2.8','Price elasticity of supply (PES)','["Topic", "2.8.1 definition of PES 2.8.2 calculation of PES", "2.8.3 determinants of PES", "2.8.4 significance of PES"]'::jsonb,7),
    ('2','2.9','Market economic system','["Topic", "2.9.1 definition of market economic system", "2.9.2 advantages and disadvantages of the market economic system"]'::jsonb,8),
    ('2','2.10','Market failure','["Topic", "2.10.1 definition of market failure", "2.10.2 causes of market failure", "2.10.3 consequences of market failure"]'::jsonb,9),
    ('2','2.11','Mixed economic system','["Topic", "2.11.1 definition of the mixed economic system 2.11.2 government intervention to address market failure"]'::jsonb,10),
    ('3','3.1','Money and banking','["Topic", "3.1.1 money 3.1.2 banking"]'::jsonb,0),
    ('3','3.2','Households','["Topic", "3.2.1 the influences on spending, saving and borrowing"]'::jsonb,1),
    ('3','3.3','Workers','["Topic", "3.3.1 factors affecting an individual''s choice of occupation 3.3.2 wage determination", "3.3.3 reasons for differences in earnings", "3.3.4 division of labour/specialisation"]'::jsonb,2),
    ('3','3.4','Trade unions','["Topic", "3.4.1 definition of a trade union 3.4.2 the role of trade unions in the economy", "3.4.3 the advantages and disadvantages of trade union activity"]'::jsonb,3),
    ('3','3.5','Firms','["Topic", "3.5.1 classification of firms", "3.5.2 small firms", "3.5.3 causes and forms of the growth of firms", "3.5.4 mergers", "3.5.5 economies and diseconomies of scale"]'::jsonb,4),
    ('3','3.6','Firms and production','["Topic", "3.6.1 demand for factors of production", "3.6.2 labour-intensive and capital-intensive production 3.6.3 production and productivity"]'::jsonb,5),
    ('3','3.7','Firms'' costs, revenue and objectives','["Topic", "3.7.1 definition of costs of production", "3.7.2 calculation of costs of production", "3.7.3 definition of revenue", "3.7.4 calculation of revenue", "3.7.5 objectives of firms"]'::jsonb,6),
    ('3','3.8','Market structure','["Topic", "3.8.1 competitive markets", "3.8.2 monopoly markets"]'::jsonb,7),
    ('4','4.1','The role of government','["Topic", "4.1.1 the role of government"]'::jsonb,0),
    ('4','4.2','The macroeconomic aims of government','["Topic", "4.2.1 the macroeconomic aims of government", "4.2.2 possible conflicts between macroeconomic aims"]'::jsonb,1),
    ('4','4.3','Fiscal policy','["Topic", "4.3.1 definition of the government budget 4.3.2 reasons for government spending", "4.3.3 reasons for taxation", "4.3.4 classification of taxes", "4.3.5 principles of taxation 4.3.6 impact of taxation", "Topic", "4.3.7 definition of fiscal policy 4.3.8 fiscal policy measures", "4.3.9 effects of fiscal policy on government macroeconomic aims"]'::jsonb,2),
    ('4','4.4','Monetary policy','["Topic", "4.4.1 definition of money supply and monetary policy 4.4.2 monetary policy measures", "4.4.3 effects of monetary policy on government macroeconomic aims"]'::jsonb,3),
    ('4','4.5','Supply-side policy','["Topic", "4.5.1 definition of supply-side policy 4.5.2 supply-side policy measures", "4.5.3 effects of supply-side policy measures on government macroeconomic aims"]'::jsonb,4),
    ('4','4.6','Economic growth','["Topic", "4.6.1 definition of economic growth 4.6.2 measurement of economic growth", "4.6.3 causes and consequences of recession", "4.6.4 causes of economic growth", "4.6.5 consequences of economic growth", "4.6.6 policies to promote economic growth"]'::jsonb,5),
    ('4','4.7','Employment and unemployment','["Topic", "4.7.1 definition of employment, unemployment and full employment 4.7.2 changing patterns and level of employment", "4.7.3 measurement of unemployment", "4.7.4 causes/types of unemployment 4.7.5 consequences of unemployment", "4.7.6 policies to reduce unemployment"]'::jsonb,6),
    ('4','4.8','Inflation and deflation','["Topic", "4.8.1 definition of inflation and deflation 4.8.2 measurement of inflation and deflation", "4.8.3 causes of inflation and deflation", "4.8.4 consequences of inflation and deflation", "4.8.5 policies to control inflation and deflation"]'::jsonb,7),
    ('5','5.1','Living standards','["Topic", "5.1.1 indicators of living standards", "5.1.2 comparing living standards and income distribution"]'::jsonb,0),
    ('5','5.2','Poverty','["Topic", "5.2.1 definition of absolute and relative poverty 5.2.2 the causes of poverty", "5.2.3 policies to alleviate poverty and redistribute income"]'::jsonb,1),
    ('5','5.3','Population','["Topic", "5.3.1 the factors that affect population growth", "5.3.2 reasons for different rates of population growth in different countries 5.3.3 the effects of changes in the size and structure of population on different countries"]'::jsonb,2),
    ('5','5.4','Differences in economic development between countries','["Topic", "5.4.1 differences in economic development between countries"]'::jsonb,3),
    ('6','6.1','International specialisation','["Topic", "6.1.1 specialisation at a national level", "6.1.2 advantages and disadvantages of specialisation at a national level"]'::jsonb,0),
    ('6','6.2','Globalisation, free trade and protection','["Topic", "6.2.1 definition of globalisation 6.2.2 role of multinational companies (MNCs)", "6.2.3 the benefits of free trade", "6.2.4 methods of protection 6.2.5 reasons for protection", "6.2.6 consequences of protection"]'::jsonb,1),
    ('6','6.3','Foreign exchange rates','["Topic", "6.3.1 definition of foreign exchange rate 6.3.2 determination of foreign exchange rate in foreign exchange market", "6.3.3 causes of foreign exchange rate fluctuations", "6.3.4 consequences of foreign exchange rate fluctuations", "6.3.5 floating and fixed foreign exchange rates"]'::jsonb,2),
    ('6','6.4','Current account of balance of payments','["Topic", "6.4.1 structure", "6.4.2 causes of current account deficit and surplus 6.4.3 consequences of current account deficit and surplus 6.4.4 policies to achieve balance of payments stability"]'::jsonb,3)
  ) AS x(tcode, scode, sname, objectives, sort)
  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;
  RAISE NOTICE 'Loaded Economics O Level (O1)';
END $$;


DO $$
DECLARE v_org uuid; v_subject uuid; v_tpl uuid;
BEGIN
  SELECT id, org_id INTO v_subject, v_org FROM public.subjects
    WHERE program='O Level (O2)' AND name='Economics' AND deleted_at IS NULL LIMIT 1;
  IF v_subject IS NULL THEN RAISE NOTICE 'Economics O Level (O2) not found - skipped'; RETURN; END IF;
  SELECT id INTO v_tpl FROM public.syllabus_templates
    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_tpl IS NULL THEN
    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)
      VALUES(v_org,v_subject,'2026','2281','active') RETURNING id INTO v_tpl;
  ELSE
    UPDATE public.syllabus_templates SET academic_year='2026', cambridge_code='2281', updated_at=now() WHERE id=v_tpl;
    UPDATE public.syllabus_subtopics SET deleted_at=now()
      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);
    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;
  END IF;
  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES
    (v_org,v_tpl,'1','The basic economic problem',0),
    (v_org,v_tpl,'2','The allocation of resources',1),
    (v_org,v_tpl,'3','Microeconomic decision makers',2),
    (v_org,v_tpl,'4','Government and the macroeconomy',3),
    (v_org,v_tpl,'5','Economic development',4),
    (v_org,v_tpl,'6','International trade and globalisation',5);
  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)
  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES
    ('1','1.1','The nature of the economic problem','["Topic", "1.1.1 finite resources and unlimited wants", "1.1.2 economic and free goods"]'::jsonb,0),
    ('1','1.2','The factors of production','["Topic", "1.2.1 definitions of the factors of production and their rewards", "1.2.2 mobility of the factors of production", "1.2.3 quantity and quality of the factors of production"]'::jsonb,1),
    ('1','1.3','Opportunity cost','["Topic", "1.3.1 definition of opportunity cost", "1.3.2 the influence of opportunity cost on decision making"]'::jsonb,2),
    ('1','1.4','Production possibility curve (PPC) diagrams','["Topic", "1.4.1 definition of PPC", "1.4.2 points under, on and beyond a PPC", "1.4.3 movements along a PPC 1.4.4 shifts in a PPC"]'::jsonb,3),
    ('2','2.1','Microeconomics and macroeconomics','["Topic", "2.1.1 microeconomics 2.1.2 macroeconomics"]'::jsonb,0),
    ('2','2.2','The role of markets in allocating resources','["Topic", "2.2.1 the market system", "2.2.2 key resources allocation decisions", "2.2.3 introduction to the price mechanism"]'::jsonb,1),
    ('2','2.3','Demand','["Topic", "2.3.1 definition of demand", "2.3.2 price, demand and quantity", "2.3.3 individual and market demand", "2.3.4 conditions of demand"]'::jsonb,2),
    ('2','2.4','Supply','["Topic", "2.4.1 definition of supply", "2.4.2 price, supply and quantity", "2.4.3 individual and market supply", "2.4.4 conditions of supply"]'::jsonb,3),
    ('2','2.5','Price determination','["Topic", "2.5.1 market equilibrium", "2.5.2 market disequilibrium"]'::jsonb,4),
    ('2','2.6','Price changes','["Topic", "2.6.1 causes of price changes", "2.6.2 consequences of price changes"]'::jsonb,5),
    ('2','2.7','Price elasticity of demand (PED)','["Topic", "2.7.1 definition of PED 2.7.2 calculation of PED", "2.7.3 determinants of PED", "2.7.4 PED and total spending on a product/ revenue", "2.7.5 significance of PED"]'::jsonb,6),
    ('2','2.8','Price elasticity of supply (PES)','["Topic", "2.8.1 definition of PES 2.8.2 calculation of PES", "2.8.3 determinants of PES", "2.8.4 significance of PES"]'::jsonb,7),
    ('2','2.9','Market economic system','["Topic", "2.9.1 definition of market economic system", "2.9.2 advantages and disadvantages of the market economic system"]'::jsonb,8),
    ('2','2.10','Market failure','["Topic", "2.10.1 definition of market failure", "2.10.2 causes of market failure", "2.10.3 consequences of market failure"]'::jsonb,9),
    ('2','2.11','Mixed economic system','["Topic", "2.11.1 definition of the mixed economic system 2.11.2 government intervention to address market failure"]'::jsonb,10),
    ('3','3.1','Money and banking','["Topic", "3.1.1 money 3.1.2 banking"]'::jsonb,0),
    ('3','3.2','Households','["Topic", "3.2.1 the influences on spending, saving and borrowing"]'::jsonb,1),
    ('3','3.3','Workers','["Topic", "3.3.1 factors affecting an individual''s choice of occupation 3.3.2 wage determination", "3.3.3 reasons for differences in earnings", "3.3.4 division of labour/specialisation"]'::jsonb,2),
    ('3','3.4','Trade unions','["Topic", "3.4.1 definition of a trade union 3.4.2 the role of trade unions in the economy", "3.4.3 the advantages and disadvantages of trade union activity"]'::jsonb,3),
    ('3','3.5','Firms','["Topic", "3.5.1 classification of firms", "3.5.2 small firms", "3.5.3 causes and forms of the growth of firms", "3.5.4 mergers", "3.5.5 economies and diseconomies of scale"]'::jsonb,4),
    ('3','3.6','Firms and production','["Topic", "3.6.1 demand for factors of production", "3.6.2 labour-intensive and capital-intensive production 3.6.3 production and productivity"]'::jsonb,5),
    ('3','3.7','Firms'' costs, revenue and objectives','["Topic", "3.7.1 definition of costs of production", "3.7.2 calculation of costs of production", "3.7.3 definition of revenue", "3.7.4 calculation of revenue", "3.7.5 objectives of firms"]'::jsonb,6),
    ('3','3.8','Market structure','["Topic", "3.8.1 competitive markets", "3.8.2 monopoly markets"]'::jsonb,7),
    ('4','4.1','The role of government','["Topic", "4.1.1 the role of government"]'::jsonb,0),
    ('4','4.2','The macroeconomic aims of government','["Topic", "4.2.1 the macroeconomic aims of government", "4.2.2 possible conflicts between macroeconomic aims"]'::jsonb,1),
    ('4','4.3','Fiscal policy','["Topic", "4.3.1 definition of the government budget 4.3.2 reasons for government spending", "4.3.3 reasons for taxation", "4.3.4 classification of taxes", "4.3.5 principles of taxation 4.3.6 impact of taxation", "Topic", "4.3.7 definition of fiscal policy 4.3.8 fiscal policy measures", "4.3.9 effects of fiscal policy on government macroeconomic aims"]'::jsonb,2),
    ('4','4.4','Monetary policy','["Topic", "4.4.1 definition of money supply and monetary policy 4.4.2 monetary policy measures", "4.4.3 effects of monetary policy on government macroeconomic aims"]'::jsonb,3),
    ('4','4.5','Supply-side policy','["Topic", "4.5.1 definition of supply-side policy 4.5.2 supply-side policy measures", "4.5.3 effects of supply-side policy measures on government macroeconomic aims"]'::jsonb,4),
    ('4','4.6','Economic growth','["Topic", "4.6.1 definition of economic growth 4.6.2 measurement of economic growth", "4.6.3 causes and consequences of recession", "4.6.4 causes of economic growth", "4.6.5 consequences of economic growth", "4.6.6 policies to promote economic growth"]'::jsonb,5),
    ('4','4.7','Employment and unemployment','["Topic", "4.7.1 definition of employment, unemployment and full employment 4.7.2 changing patterns and level of employment", "4.7.3 measurement of unemployment", "4.7.4 causes/types of unemployment 4.7.5 consequences of unemployment", "4.7.6 policies to reduce unemployment"]'::jsonb,6),
    ('4','4.8','Inflation and deflation','["Topic", "4.8.1 definition of inflation and deflation 4.8.2 measurement of inflation and deflation", "4.8.3 causes of inflation and deflation", "4.8.4 consequences of inflation and deflation", "4.8.5 policies to control inflation and deflation"]'::jsonb,7),
    ('5','5.1','Living standards','["Topic", "5.1.1 indicators of living standards", "5.1.2 comparing living standards and income distribution"]'::jsonb,0),
    ('5','5.2','Poverty','["Topic", "5.2.1 definition of absolute and relative poverty 5.2.2 the causes of poverty", "5.2.3 policies to alleviate poverty and redistribute income"]'::jsonb,1),
    ('5','5.3','Population','["Topic", "5.3.1 the factors that affect population growth", "5.3.2 reasons for different rates of population growth in different countries 5.3.3 the effects of changes in the size and structure of population on different countries"]'::jsonb,2),
    ('5','5.4','Differences in economic development between countries','["Topic", "5.4.1 differences in economic development between countries"]'::jsonb,3),
    ('6','6.1','International specialisation','["Topic", "6.1.1 specialisation at a national level", "6.1.2 advantages and disadvantages of specialisation at a national level"]'::jsonb,0),
    ('6','6.2','Globalisation, free trade and protection','["Topic", "6.2.1 definition of globalisation 6.2.2 role of multinational companies (MNCs)", "6.2.3 the benefits of free trade", "6.2.4 methods of protection 6.2.5 reasons for protection", "6.2.6 consequences of protection"]'::jsonb,1),
    ('6','6.3','Foreign exchange rates','["Topic", "6.3.1 definition of foreign exchange rate 6.3.2 determination of foreign exchange rate in foreign exchange market", "6.3.3 causes of foreign exchange rate fluctuations", "6.3.4 consequences of foreign exchange rate fluctuations", "6.3.5 floating and fixed foreign exchange rates"]'::jsonb,2),
    ('6','6.4','Current account of balance of payments','["Topic", "6.4.1 structure", "6.4.2 causes of current account deficit and surplus 6.4.3 consequences of current account deficit and surplus 6.4.4 policies to achieve balance of payments stability"]'::jsonb,3)
  ) AS x(tcode, scode, sname, objectives, sort)
  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;
  RAISE NOTICE 'Loaded Economics O Level (O2)';
END $$;
