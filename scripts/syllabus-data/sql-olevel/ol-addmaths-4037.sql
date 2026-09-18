-- Additional Mathematics (4037) - Cambridge O Level outline with objectives, loaded into O1 + O2.

DO $$
DECLARE v_org uuid; v_subject uuid; v_tpl uuid;
BEGIN
  SELECT id, org_id INTO v_subject, v_org FROM public.subjects
    WHERE program='O Level (O1)' AND name='Additional Mathematics' AND deleted_at IS NULL LIMIT 1;
  IF v_subject IS NULL THEN RAISE NOTICE 'Additional Mathematics O Level (O1) not found - skipped'; RETURN; END IF;
  SELECT id INTO v_tpl FROM public.syllabus_templates
    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_tpl IS NULL THEN
    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)
      VALUES(v_org,v_subject,'2025-2027','4037','active') RETURNING id INTO v_tpl;
  ELSE
    UPDATE public.syllabus_templates SET academic_year='2025-2027', cambridge_code='4037', updated_at=now() WHERE id=v_tpl;
    UPDATE public.syllabus_subtopics SET deleted_at=now()
      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);
    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;
  END IF;
  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES
    (v_org,v_tpl,'1','Functions',0),
    (v_org,v_tpl,'2','Quadratic functions',1),
    (v_org,v_tpl,'3','Factors of polynomials',2),
    (v_org,v_tpl,'4','Equations, inequalities and graphs',3),
    (v_org,v_tpl,'5','Simultaneous equations',4),
    (v_org,v_tpl,'6','Logarithmic and exponential functions',5),
    (v_org,v_tpl,'7','Straight-line graphs',6),
    (v_org,v_tpl,'8','Coordinate geometry of the circle',7),
    (v_org,v_tpl,'9','Circular measure',8),
    (v_org,v_tpl,'10','Trigonometry',9),
    (v_org,v_tpl,'11','Permutations and combinations',10),
    (v_org,v_tpl,'12','Series',11),
    (v_org,v_tpl,'13','Vectors in two dimensions',12),
    (v_org,v_tpl,'14','Calculus',13);
  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)
  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES
    ('1','1','Functions','["Understand the terms: function, domain, range (image set), one-one function, many-one function, inverse function and composition of functions.", "Find the domain and range of functions.", "Recognise and use function notation.", "Understand the relationship between y = f(x) and y = |f(x)|, where f(x) may be linear, quadratic, cubic or trigonometric.", "Explain in words why a given function does not have an inverse.", "Find the inverse of a one-one function.", "Form and use composite functions.", "Use sketch graphs to show the relationship between a function and its inverse."]'::jsonb,0),
    ('2','2','Quadratic functions','["Find the maximum or minimum value of the completing the square or by differentiation. Use the maximum or minimum value of f(x) to", "sketch the graph of y = f(x) or determine the range for a given domain. Know the conditions for f(x) = 0 to have:", "(i) two real roots (ii) two equal roots (iii) no real roots and the related conditions for a given line to: (i) intersect a given curve (ii) be a tangent to a given curve", "Solve quadratic equations for real roots.", "Find the solution set for quadratic inequalities either graphically or algebraically."]'::jsonb,0),
    ('3','3','Factors of polynomials','["Know and use the remainder and factor theorems.", "Find factors of polynomials.", "Solve cubic equations."]'::jsonb,0),
    ('4','4','Equations, inequalities and graphs','["Solve equations of the type • |ax + b| = cx + d • |ax + b| = |cx + d| • |ax2 + bx + c| = d • using algebraic or graphical methods.", "Solve graphically or algebraically inequalities k|ax + b| > c (c ⩾ 0) of the type k|ax + b| ⩽ c (c > 0) • k|ax + b| ⩽ |cx + d| • • |ax + b| ⩽ cx + d where k > 0 |ax2 + bx + c| > d • |ax2 + bx + c| ⩽ d • •", "Use substitution to form and solve a quadratic equation in order to solve a related equation.", "Sketch the graphs of cubic polynomials and their moduli, when given as a product of three linear factors. f(x) ⩾ d", "Solve graphically cubic inequalities of the form • f(x) ⩽ d f(x) > d • • f(x) < d • where f(x) is a product of three linear factors and d is a constant."]'::jsonb,0),
    ('5','5','Simultaneous equations','["Solve simultaneous equations in two unknowns by elimination or substitution."]'::jsonb,0),
    ('6','6','Logarithmic and exponential functions','["Know and use simple properties and graphs of the logarithmic and exponential functions, including ln x and ex.", "Know and use the laws of logarithms, including change of base of logarithms. Solve equations of the form ax = b."]'::jsonb,0),
    ('7','7','Straight-line graphs','["Use the equation of a straight line.", "Know and use the condition for two lines to be parallel or perpendicular.", "Solve problems involving midpoint and length of a line, including finding and using the equation of a perpendicular bisector.", "Transform given relationships to and from straight-line form, including determining unknown constants by calculating the gradient or intercept of the transformed graph."]'::jsonb,0),
    ('8','8','Coordinate geometry of the circle','["Know and use the equation of a circle with radius r and centre (a, b).", "Solve problems involving the intersection of a circle and a straight line.", "Solve problems involving tangents to a circle.", "Solve problems involving the intersection of two circles."]'::jsonb,0),
    ('9','9','Circular measure','["Solve problems involving the arc length and sector area of a circle, including knowledge and use of radian measure."]'::jsonb,0),
    ('10','10','Trigonometry','["Know and use the six trigonometric functions of angles of any magnitude.", "Understand and use the amplitude and period of a trigonometric function, including the relationship between graphs of related trigonometric functions.", "Draw and use the graphs of y = a sin bx + c y = a cos bx + c y = a tan bx + c where a is a positive integer, b is a simple fraction or integer, and c is an integer.", "Use the relationships: sin2 A + cos2 A = 1 • sec2 A = 1 + tan2 A • cosec2 A = 1 + cot2 A •", "Solve, for a given domain, trigonometric equations involving the six trigonometric functions.", "Prove trigonometric relationships involving the six trigonometric functions."]'::jsonb,0),
    ('11','11','Permutations and combinations','["Recognise the difference between permutations and combinations and know when each should be used.", "Know and use the notation n! and the expressions for permutations and combinations of n items taken r at a time.", "Solve problems on arrangement and selection using permutations or combinations."]'::jsonb,0),
    ('12','12','Series','["(a + b)n for positive integer n.", "Use the general term OOan-rbr, 0 ⩽ r ⩽ n . J N n KK r L P", "Recognise arithmetic and geometric progressions and understand the difference between them.", "Use the formulas for the nth term and for the sum of the first n terms to solve problems involving arithmetic or geometric progressions.", "Use the condition for the convergence of a geometric progression, and the formula for the sum to infinity of a convergent geometric progression."]'::jsonb,0),
    ('13','13','Vectors in two dimensions','["Understand and use vector notation.", "Know and use position vectors and unit vectors.", "Find the magnitude of a vector; add and subtract vectors and multiply vectors by scalars.", "Compose and resolve velocities."]'::jsonb,0),
    ('14','14','Calculus','["Understand the idea of a derived function.", "Use the notations f′(x), f″(x), d y, R V 2 J N d d y S d y W d KK OO = SS WW x 2 d x x d x d L P T X y d δx, δx → 0, x . d", "Know and use the derivatives of the standard functions xn (for any rational n), sin x, cos x, tan x, ex, ln x.", "Differentiate products and quotients of functions.", "Use differentiation to find gradients, tangents and normals.", "Use differentiation to find stationary points.", "Apply differentiation to connected rates of change, small increments and approximations.", "Apply differentiation to practical problems involving maxima and minima.", "Use the first and second derivative tests to discriminate between maxima and minima.", "Understand integration as the reverse process of differentiation.", "Integrate sums of terms in powers of x, 1 and ax 1 including x . b +", "Integrate functions of the form: (ax + b)n for any rational n • sin (ax + b) • cos (ax + b) • sec2 (ax + b) • eax+b •", "Evaluate definite integrals and apply integration to the evaluation of plane areas.", "Apply differentiation and integration to kinematics problems that involve displacement, velocity and acceleration of a particle moving in a straight line with variable or constant acceleration.", "Make use of the relationships in 14.14 to draw and use the following graphs: • displacement-time • distance-time • velocity-time • speed-time • acceleration-time."]'::jsonb,0)
  ) AS x(tcode, scode, sname, objectives, sort)
  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;
  RAISE NOTICE 'Loaded Additional Mathematics O Level (O1)';
END $$;


DO $$
DECLARE v_org uuid; v_subject uuid; v_tpl uuid;
BEGIN
  SELECT id, org_id INTO v_subject, v_org FROM public.subjects
    WHERE program='O Level (O2)' AND name='Additional Mathematics' AND deleted_at IS NULL LIMIT 1;
  IF v_subject IS NULL THEN RAISE NOTICE 'Additional Mathematics O Level (O2) not found - skipped'; RETURN; END IF;
  SELECT id INTO v_tpl FROM public.syllabus_templates
    WHERE org_id=v_org AND subject_id=v_subject AND status='active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF v_tpl IS NULL THEN
    INSERT INTO public.syllabus_templates(org_id,subject_id,academic_year,cambridge_code,status)
      VALUES(v_org,v_subject,'2025-2027','4037','active') RETURNING id INTO v_tpl;
  ELSE
    UPDATE public.syllabus_templates SET academic_year='2025-2027', cambridge_code='4037', updated_at=now() WHERE id=v_tpl;
    UPDATE public.syllabus_subtopics SET deleted_at=now()
      WHERE topic_id IN (SELECT id FROM public.syllabus_topics WHERE template_id=v_tpl AND deleted_at IS NULL);
    UPDATE public.syllabus_topics SET deleted_at=now() WHERE template_id=v_tpl AND deleted_at IS NULL;
  END IF;
  INSERT INTO public.syllabus_topics(org_id,template_id,code,name,sort) VALUES
    (v_org,v_tpl,'1','Functions',0),
    (v_org,v_tpl,'2','Quadratic functions',1),
    (v_org,v_tpl,'3','Factors of polynomials',2),
    (v_org,v_tpl,'4','Equations, inequalities and graphs',3),
    (v_org,v_tpl,'5','Simultaneous equations',4),
    (v_org,v_tpl,'6','Logarithmic and exponential functions',5),
    (v_org,v_tpl,'7','Straight-line graphs',6),
    (v_org,v_tpl,'8','Coordinate geometry of the circle',7),
    (v_org,v_tpl,'9','Circular measure',8),
    (v_org,v_tpl,'10','Trigonometry',9),
    (v_org,v_tpl,'11','Permutations and combinations',10),
    (v_org,v_tpl,'12','Series',11),
    (v_org,v_tpl,'13','Vectors in two dimensions',12),
    (v_org,v_tpl,'14','Calculus',13);
  INSERT INTO public.syllabus_subtopics(org_id,topic_id,code,name,objectives,sort)
  SELECT v_org, t.id, x.scode, x.sname, x.objectives, x.sort FROM (VALUES
    ('1','1','Functions','["Understand the terms: function, domain, range (image set), one-one function, many-one function, inverse function and composition of functions.", "Find the domain and range of functions.", "Recognise and use function notation.", "Understand the relationship between y = f(x) and y = |f(x)|, where f(x) may be linear, quadratic, cubic or trigonometric.", "Explain in words why a given function does not have an inverse.", "Find the inverse of a one-one function.", "Form and use composite functions.", "Use sketch graphs to show the relationship between a function and its inverse."]'::jsonb,0),
    ('2','2','Quadratic functions','["Find the maximum or minimum value of the completing the square or by differentiation. Use the maximum or minimum value of f(x) to", "sketch the graph of y = f(x) or determine the range for a given domain. Know the conditions for f(x) = 0 to have:", "(i) two real roots (ii) two equal roots (iii) no real roots and the related conditions for a given line to: (i) intersect a given curve (ii) be a tangent to a given curve", "Solve quadratic equations for real roots.", "Find the solution set for quadratic inequalities either graphically or algebraically."]'::jsonb,0),
    ('3','3','Factors of polynomials','["Know and use the remainder and factor theorems.", "Find factors of polynomials.", "Solve cubic equations."]'::jsonb,0),
    ('4','4','Equations, inequalities and graphs','["Solve equations of the type • |ax + b| = cx + d • |ax + b| = |cx + d| • |ax2 + bx + c| = d • using algebraic or graphical methods.", "Solve graphically or algebraically inequalities k|ax + b| > c (c ⩾ 0) of the type k|ax + b| ⩽ c (c > 0) • k|ax + b| ⩽ |cx + d| • • |ax + b| ⩽ cx + d where k > 0 |ax2 + bx + c| > d • |ax2 + bx + c| ⩽ d • •", "Use substitution to form and solve a quadratic equation in order to solve a related equation.", "Sketch the graphs of cubic polynomials and their moduli, when given as a product of three linear factors. f(x) ⩾ d", "Solve graphically cubic inequalities of the form • f(x) ⩽ d f(x) > d • • f(x) < d • where f(x) is a product of three linear factors and d is a constant."]'::jsonb,0),
    ('5','5','Simultaneous equations','["Solve simultaneous equations in two unknowns by elimination or substitution."]'::jsonb,0),
    ('6','6','Logarithmic and exponential functions','["Know and use simple properties and graphs of the logarithmic and exponential functions, including ln x and ex.", "Know and use the laws of logarithms, including change of base of logarithms. Solve equations of the form ax = b."]'::jsonb,0),
    ('7','7','Straight-line graphs','["Use the equation of a straight line.", "Know and use the condition for two lines to be parallel or perpendicular.", "Solve problems involving midpoint and length of a line, including finding and using the equation of a perpendicular bisector.", "Transform given relationships to and from straight-line form, including determining unknown constants by calculating the gradient or intercept of the transformed graph."]'::jsonb,0),
    ('8','8','Coordinate geometry of the circle','["Know and use the equation of a circle with radius r and centre (a, b).", "Solve problems involving the intersection of a circle and a straight line.", "Solve problems involving tangents to a circle.", "Solve problems involving the intersection of two circles."]'::jsonb,0),
    ('9','9','Circular measure','["Solve problems involving the arc length and sector area of a circle, including knowledge and use of radian measure."]'::jsonb,0),
    ('10','10','Trigonometry','["Know and use the six trigonometric functions of angles of any magnitude.", "Understand and use the amplitude and period of a trigonometric function, including the relationship between graphs of related trigonometric functions.", "Draw and use the graphs of y = a sin bx + c y = a cos bx + c y = a tan bx + c where a is a positive integer, b is a simple fraction or integer, and c is an integer.", "Use the relationships: sin2 A + cos2 A = 1 • sec2 A = 1 + tan2 A • cosec2 A = 1 + cot2 A •", "Solve, for a given domain, trigonometric equations involving the six trigonometric functions.", "Prove trigonometric relationships involving the six trigonometric functions."]'::jsonb,0),
    ('11','11','Permutations and combinations','["Recognise the difference between permutations and combinations and know when each should be used.", "Know and use the notation n! and the expressions for permutations and combinations of n items taken r at a time.", "Solve problems on arrangement and selection using permutations or combinations."]'::jsonb,0),
    ('12','12','Series','["(a + b)n for positive integer n.", "Use the general term OOan-rbr, 0 ⩽ r ⩽ n . J N n KK r L P", "Recognise arithmetic and geometric progressions and understand the difference between them.", "Use the formulas for the nth term and for the sum of the first n terms to solve problems involving arithmetic or geometric progressions.", "Use the condition for the convergence of a geometric progression, and the formula for the sum to infinity of a convergent geometric progression."]'::jsonb,0),
    ('13','13','Vectors in two dimensions','["Understand and use vector notation.", "Know and use position vectors and unit vectors.", "Find the magnitude of a vector; add and subtract vectors and multiply vectors by scalars.", "Compose and resolve velocities."]'::jsonb,0),
    ('14','14','Calculus','["Understand the idea of a derived function.", "Use the notations f′(x), f″(x), d y, R V 2 J N d d y S d y W d KK OO = SS WW x 2 d x x d x d L P T X y d δx, δx → 0, x . d", "Know and use the derivatives of the standard functions xn (for any rational n), sin x, cos x, tan x, ex, ln x.", "Differentiate products and quotients of functions.", "Use differentiation to find gradients, tangents and normals.", "Use differentiation to find stationary points.", "Apply differentiation to connected rates of change, small increments and approximations.", "Apply differentiation to practical problems involving maxima and minima.", "Use the first and second derivative tests to discriminate between maxima and minima.", "Understand integration as the reverse process of differentiation.", "Integrate sums of terms in powers of x, 1 and ax 1 including x . b +", "Integrate functions of the form: (ax + b)n for any rational n • sin (ax + b) • cos (ax + b) • sec2 (ax + b) • eax+b •", "Evaluate definite integrals and apply integration to the evaluation of plane areas.", "Apply differentiation and integration to kinematics problems that involve displacement, velocity and acceleration of a particle moving in a straight line with variable or constant acceleration.", "Make use of the relationships in 14.14 to draw and use the following graphs: • displacement-time • distance-time • velocity-time • speed-time • acceleration-time."]'::jsonb,0)
  ) AS x(tcode, scode, sname, objectives, sort)
  JOIN public.syllabus_topics t ON t.template_id=v_tpl AND t.code=x.tcode AND t.deleted_at IS NULL;
  RAISE NOTICE 'Loaded Additional Mathematics O Level (O2)';
END $$;
