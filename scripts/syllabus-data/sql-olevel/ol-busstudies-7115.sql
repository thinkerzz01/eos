-- Business Studies (7115) - Cambridge O Level outline with objectives, loaded into O1 + O2.

DO $$
DECLARE v_org uuid; v_subject uuid; v_tpl uuid;
BEGIN
  SELECT id, org_id INTO v_subject, v_org FROM public.subjects
    WHERE program='O Level (O1)' AND name='Business Studies' AND deleted_at IS NULL LIMIT 1;
  IF v_subject IS NULL THEN RAISE NOTICE 'Business Studies O Level (O1) not found - skipped'; RETURN; END IF;
  SELECT id INTO v_tpl FROM public.syllabus_templates
    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_tpl IS NULL THEN
    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)
      VALUES(v_org,v_subject,'2023-2025','7115','active') RETURNING id INTO v_tpl;
  ELSE
    UPDATE public.syllabus_templates SET academic_year='2023-2025', cambridge_code='7115', updated_at=now() WHERE id=v_tpl;
    UPDATE public.syllabus_subtopics SET deleted_at=now()
      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);
    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;
  END IF;
  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES
    (v_org,v_tpl,'1','Understanding business activity',0),
    (v_org,v_tpl,'2','People in business',1),
    (v_org,v_tpl,'3','Marketing',2),
    (v_org,v_tpl,'4','Operations management',3),
    (v_org,v_tpl,'5','Financial information and decisions',4),
    (v_org,v_tpl,'6','External influences on business activity',5);
  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)
  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES
    ('1','1.1','Business activity','["The purpose and nature of business activity:"]'::jsonb,0),
    ('1','1.2','Classification of businesses','["Economic sectors in terms of primary, secondary and tertiary sectors:", "Classify business enterprises between private sector and public sector in a mixed economy"]'::jsonb,1),
    ('1','1.3','Enterprise, business growth and size','["Enterprise and entrepreneurship:", "The methods and problems of measuring business size:", "Why some businesses grow and others remain small:", "Why some (new or established) businesses fail:"]'::jsonb,2),
    ('1','1.4','Types of business organisation','["The main features of different forms of business organisation:"]'::jsonb,3),
    ('1','1.5','Business objectives and stakeholder objectives','["Businesses can have several objectives and the importance of them can change:", "The role of stakeholder groups involved in business activity:", "Differences in the objectives of private sector and public sector enterprises"]'::jsonb,4),
    ('2','2.1','Motivating employees','["The importance of a well-motivated workforce:", "Methods of motivation:"]'::jsonb,0),
    ('2','2.2','Organisation and management','["Draw, interpret and understand simple organisational charts:", "The role of management:", "Leadership styles:", "Trade unions:"]'::jsonb,1),
    ('2','2.3','Recruitment, selection and training of employees','["Recruitment and selecting employees:", "The importance of training and the methods of training:", "Why reducing the size of the workforce might be necessary:", "Legal controls over employment issues and their impact on employers and employees:"]'::jsonb,2),
    ('2','2.4','Internal and external communication','["Why effective communication is important and the methods used to achieve it:", "Demonstrate an awareness of communication barriers:"]'::jsonb,3),
    ('3','3.1','Marketing, competition and the customer','["The role of marketing:", "Market changes:", "Concepts of niche marketing and mass marketing:", "How and why market segmentation is undertaken:"]'::jsonb,0),
    ('3','3.2','Market research','["The role of market research and methods used:", "Presentation and use of market research results:"]'::jsonb,1),
    ('3','3.3','Marketing mix','["Product:", "Price:", "Place - distribution channels:", "Promotion:", "Technology and the marketing mix:"]'::jsonb,2),
    ('3','3.4','Marketing strategy','["Justify marketing strategies appropriate to a given situation:", "The nature and impact of legal controls related to marketing:", "The opportunities and problems of entering new foreign markets:"]'::jsonb,3),
    ('4','4.1','Production of goods and services','["The meaning of production:", "The main methods of production:", "How technology has changed and is changing production methods, e.g. using computers in design and manufacturing"]'::jsonb,0),
    ('4','4.2','Costs, scale of production and break-even analysis','["Identify and classify costs:", "Economies and diseconomies of scale:", "Break-even analysis:"]'::jsonb,1),
    ('4','4.3','Achieving quality production','["Why quality is important and how quality production might be achieved:"]'::jsonb,2),
    ('4','4.4','Location decisions','["The main factors influencing the location and relocation decisions of a business:"]'::jsonb,3),
    ('5','5.1','Business finance: needs and sources','["The need for business finance:", "The main sources of finance:"]'::jsonb,0),
    ('5','5.2','Cash-flow forecasting and working capital','["The importance of cash and of cash-flow forecasting:", "Working capital:"]'::jsonb,1),
    ('5','5.3','Income statements','["What profit is and why it is important:", "Income statements:"]'::jsonb,2),
    ('5','5.4','Statement of financial position','["The main elements of a statement of financial position:", "Interpret a simple statement of financial position and make deductions from it, e.g. how a business is financing its activities and what assets it owns, sale of inventories to raise finance (constructing statements of financial position will not be assessed)"]'::jsonb,3),
    ('5','5.5','Analysis of accounts','["Profitability:", "Liquidity:", "How to interpret the financial performance of a business by calculating and analysing profitability ratios and liquidity ratios:", "Why and how accounts are used:"]'::jsonb,4),
    ('6','6.1','Economic issues','["Business cycle:", "How government control over the economy affects business activity and how businesses may respond:"]'::jsonb,0),
    ('6','6.2','Environmental and ethical issues','["Environmental concerns and ethical issues as both opportunities and constraints for businesses:"]'::jsonb,1),
    ('6','6.3','Business and the international economy','["The importance of globalisation:", "Reasons for the importance and growth of multinational companies (MNCs):", "The impact of exchange rate changes:"]'::jsonb,2)
  ) AS x(tcode, scode, sname, objectives, sort)
  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;
  RAISE NOTICE 'Loaded Business Studies O Level (O1)';
END $$;


DO $$
DECLARE v_org uuid; v_subject uuid; v_tpl uuid;
BEGIN
  SELECT id, org_id INTO v_subject, v_org FROM public.subjects
    WHERE program='O Level (O2)' AND name='Business Studies' AND deleted_at IS NULL LIMIT 1;
  IF v_subject IS NULL THEN RAISE NOTICE 'Business Studies O Level (O2) not found - skipped'; RETURN; END IF;
  SELECT id INTO v_tpl FROM public.syllabus_templates
    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_tpl IS NULL THEN
    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)
      VALUES(v_org,v_subject,'2023-2025','7115','active') RETURNING id INTO v_tpl;
  ELSE
    UPDATE public.syllabus_templates SET academic_year='2023-2025', cambridge_code='7115', updated_at=now() WHERE id=v_tpl;
    UPDATE public.syllabus_subtopics SET deleted_at=now()
      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);
    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;
  END IF;
  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES
    (v_org,v_tpl,'1','Understanding business activity',0),
    (v_org,v_tpl,'2','People in business',1),
    (v_org,v_tpl,'3','Marketing',2),
    (v_org,v_tpl,'4','Operations management',3),
    (v_org,v_tpl,'5','Financial information and decisions',4),
    (v_org,v_tpl,'6','External influences on business activity',5);
  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)
  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES
    ('1','1.1','Business activity','["The purpose and nature of business activity:"]'::jsonb,0),
    ('1','1.2','Classification of businesses','["Economic sectors in terms of primary, secondary and tertiary sectors:", "Classify business enterprises between private sector and public sector in a mixed economy"]'::jsonb,1),
    ('1','1.3','Enterprise, business growth and size','["Enterprise and entrepreneurship:", "The methods and problems of measuring business size:", "Why some businesses grow and others remain small:", "Why some (new or established) businesses fail:"]'::jsonb,2),
    ('1','1.4','Types of business organisation','["The main features of different forms of business organisation:"]'::jsonb,3),
    ('1','1.5','Business objectives and stakeholder objectives','["Businesses can have several objectives and the importance of them can change:", "The role of stakeholder groups involved in business activity:", "Differences in the objectives of private sector and public sector enterprises"]'::jsonb,4),
    ('2','2.1','Motivating employees','["The importance of a well-motivated workforce:", "Methods of motivation:"]'::jsonb,0),
    ('2','2.2','Organisation and management','["Draw, interpret and understand simple organisational charts:", "The role of management:", "Leadership styles:", "Trade unions:"]'::jsonb,1),
    ('2','2.3','Recruitment, selection and training of employees','["Recruitment and selecting employees:", "The importance of training and the methods of training:", "Why reducing the size of the workforce might be necessary:", "Legal controls over employment issues and their impact on employers and employees:"]'::jsonb,2),
    ('2','2.4','Internal and external communication','["Why effective communication is important and the methods used to achieve it:", "Demonstrate an awareness of communication barriers:"]'::jsonb,3),
    ('3','3.1','Marketing, competition and the customer','["The role of marketing:", "Market changes:", "Concepts of niche marketing and mass marketing:", "How and why market segmentation is undertaken:"]'::jsonb,0),
    ('3','3.2','Market research','["The role of market research and methods used:", "Presentation and use of market research results:"]'::jsonb,1),
    ('3','3.3','Marketing mix','["Product:", "Price:", "Place - distribution channels:", "Promotion:", "Technology and the marketing mix:"]'::jsonb,2),
    ('3','3.4','Marketing strategy','["Justify marketing strategies appropriate to a given situation:", "The nature and impact of legal controls related to marketing:", "The opportunities and problems of entering new foreign markets:"]'::jsonb,3),
    ('4','4.1','Production of goods and services','["The meaning of production:", "The main methods of production:", "How technology has changed and is changing production methods, e.g. using computers in design and manufacturing"]'::jsonb,0),
    ('4','4.2','Costs, scale of production and break-even analysis','["Identify and classify costs:", "Economies and diseconomies of scale:", "Break-even analysis:"]'::jsonb,1),
    ('4','4.3','Achieving quality production','["Why quality is important and how quality production might be achieved:"]'::jsonb,2),
    ('4','4.4','Location decisions','["The main factors influencing the location and relocation decisions of a business:"]'::jsonb,3),
    ('5','5.1','Business finance: needs and sources','["The need for business finance:", "The main sources of finance:"]'::jsonb,0),
    ('5','5.2','Cash-flow forecasting and working capital','["The importance of cash and of cash-flow forecasting:", "Working capital:"]'::jsonb,1),
    ('5','5.3','Income statements','["What profit is and why it is important:", "Income statements:"]'::jsonb,2),
    ('5','5.4','Statement of financial position','["The main elements of a statement of financial position:", "Interpret a simple statement of financial position and make deductions from it, e.g. how a business is financing its activities and what assets it owns, sale of inventories to raise finance (constructing statements of financial position will not be assessed)"]'::jsonb,3),
    ('5','5.5','Analysis of accounts','["Profitability:", "Liquidity:", "How to interpret the financial performance of a business by calculating and analysing profitability ratios and liquidity ratios:", "Why and how accounts are used:"]'::jsonb,4),
    ('6','6.1','Economic issues','["Business cycle:", "How government control over the economy affects business activity and how businesses may respond:"]'::jsonb,0),
    ('6','6.2','Environmental and ethical issues','["Environmental concerns and ethical issues as both opportunities and constraints for businesses:"]'::jsonb,1),
    ('6','6.3','Business and the international economy','["The importance of globalisation:", "Reasons for the importance and growth of multinational companies (MNCs):", "The impact of exchange rate changes:"]'::jsonb,2)
  ) AS x(tcode, scode, sname, objectives, sort)
  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;
  RAISE NOTICE 'Loaded Business Studies O Level (O2)';
END $$;
